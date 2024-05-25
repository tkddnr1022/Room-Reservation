let express = require('express');
let app = express();
let router = require('./router/main')(app);
let mongoose = require('mongoose'); // mongoose module
let userModel = require('./models/user.js'); // user data model
let tableModel = require('./models/table.js'); // 
let errorModel = require('./models/error.js'); // 
let jwt = require('jsonwebtoken');
let cors = require('cors');
let bodyParser = require('body-parser');
const secretKey = 'e848048';

let server = app.listen(3000, function(){
    console.log("Express server has started on port 3000")
});
let io = require('socket.io')(server);
app.use(cors({
  origin: "https://kyunzik-lsyr.run.goorm.site",
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false}));

app.use(express.static('public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

// mongoDB
mongoose.connect("mongodb://127.0.0.1:27017/kyunzik", { useUnifiedTopology: true, useNewUrlParser: true });
const db = mongoose.connection;
db.on('error', console.error);  // mongoDB 연동 실패 시 에러 메시지 출력
db.once('open', () =>{
  console.log('connected to mongoDB server'); // mongoDB 연동 성공 시 메시지 출력
});

io.on('connection', function(socket){
	client = socket.id; 
	console.log("client id " + client + " connected");
	
	socket.on('disconnect', () => {
		console.log("client id " + client + " disconnected");
	});
	
	socket.on('login', function(data){
		
		let response = {
			'valid': false, 
			'id': data.id, 
			'token': undefined,
			'team': [],
			'admin': false
		};
		
		userModel.findOne({'id': data.id}).exec()
		.then((db) => {
			if(db == null) io.to(client).emit('login_response', response);
			else{
				if(data.id === db.id && data.pw === db.pw){
					const token = jwt.sign({id: data.id}, secretKey, {expiresIn: '6h'});
					console.log(data.id+"'s token: "+token);

					response.valid = true;
					response.token = token;
					response.team = db.team;
					response.admin = db.admin;
					io.to(client).emit('login_response', response);
					JoinRoom(data.id);
					SendTable();
				}
				else{
					io.to(client).emit('login_response', response);
				}
			}
		})
		.catch((err) =>{
			console.log(err);
		});
	});
	
	socket.on('add_team', function(data){
		
		if(CheckAuth(data.token, 'admin')){
			userModel.update({
				'id': data.name
			}, 
			{$addToSet:{
				'team': {
					'name': data.teamName,
					'leader': data.leader
					}
				}
			});
		}
	});
	
	socket.on('request_reserve', function(request){
		console.log(request.token);
		console.log(request.auth);
		console.log(request.data);
		CheckAuth(request.token, request.auth, request.data).then((result)=>{
			if(result){
				tableModel.find().exec()
				.then((db)=>{
					db = JSON.parse(JSON.stringify(db));
					
					for(i in db){
						for(j in request.data){
							let team_db = db[i].index;
							let team_req = request.data[j].index;
							if(team_req.length == 0) continue;
							let temp = team_db.length + team_req.length;
							
							/*
							console.log('----');
							console.log(team_db);
							console.log(team_req);
							console.log(temp);
							console.log(new Set([...team_db,...team_req]).size)
							console.log('----');
							*/
							
							if(new Set([...team_db,...team_req]).size != temp){
								io.to(client).emit('request_reserve_response', {'result': false, 'msg': '신청 불가능한 시간입니다'});
								return;
							}
						}
					}
					
					for(i in request.data){
						let team_req = request.data[i];
						if(team_req.index.length == 0) continue;
						let instance = new tableModel({
							teamName: team_req.teamName,
							leader: request.id,
							index: team_req.index,
							timestamp: Date.now()
						});
						Save(instance).then((result)=>{
							io.to(client).emit('request_reserve_response', {'result': true, 'msg': '신청 성공'});
						});
					}
					SendTable(request.data);
				})
				.catch((err)=>{
					console.log(err);
				});
			}
		});
	});
	
	socket.on('logout', function(){
		socket.leave('reserve');
	});
	
	// 접속시 토큰 검사
	socket.on('verify_token', function(token){
		let data = {
			"id": String,
			"valid": Boolean
		};
		if(token){ // 토큰이 존재할 경우
			data = CheckToken(token);
			console.log("token: "+token+", valid: "+data.valid);
			if(data.valid){
				JoinRoom(data.id);
				SendTable();
			}
		}
		else{ // 토큰이 존재하지 않을 경우
			data.id = undefined;
			data.valid = false;
			console.log("token empty");
		}
		io.to(client).emit('verify_token_response', data);
	});
		
	function SendTable(data = undefined){
		if(data == undefined){
			tableModel.find().exec()
			.then((db)=>{
				db = JSON.parse(JSON.stringify(db));
				io.to(client).emit('send_table', db);
			})
			.catch((err)=>{
				console.log(err);
			});
		}
		else{
			socket.to('reserve').emit('send_table', data);
		}
	}
	
	function JoinRoom(id){
		socket.join('reserve');
		console.log(id + 'joined room');
	}
});

// 토큰 검증
function CheckToken(token){
	let data = {
		'id': String,
		'valid': Boolean
	};
	jwt.verify(token, secretKey, (err, decoded) => {
		if (err) { // 토큰 검증 실패
			data.valid = false;
			ReportError(data.id, 'invalid token : ' + token);
		} 
		else {
			console.log(decoded);
			data.valid = true;
			data.id = decoded.id;
		}
	});
	
	return data;
}                 

// 요청에 대한 유저 권한 검사
function CheckAuth(token, auth, index = null){
	let data = CheckToken(token);
	if(data.valid){
		return userModel.findOne({'id': data.id}).exec()
		.then((db) => {
			if(db == null) ReportError(data.id, 'invalid id, requested auth: ' + auth);
			else{
				db = JSON.parse(JSON.stringify(db));
				if(auth == 'admin'){
					if(db.admin) return true;
				}
				else if(auth == 'leader'){
					let count = 0;
					for(i in db.team){
						for(j in index){
							let team_db = db.team[i];
							let team_req = index[j];
							if(team_db.name == team_req.teamName && team_db.leader){
								count++;
								break;
							}
						}
					}
					if(count == index.length) return true;
				}
			}
			return false;
		})
		.catch((err) =>{
			console.log(err);
		});
	}
	else {
		ReportError(data.id, 'invalid authority, requested auth: ' + auth);
		return Promise.resolve(false);
	}
}

function ReportError(id, msg){
	let instance = new errorModel({
		'id': id, 
		'msg': msg, 
		'timestamp': Date.now()
	});
	let result = Save(instance);
	console.log('error reported: ' + msg);
}
	
function Save(instance){
	return instance.save().then((result) => {
		return result;
	})
	.catch((err) =>{
		console.log(err);
		return null;
	});
}