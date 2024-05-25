let createError = require('http-errors');
let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let logger = require('morgan');

let request = require('request'); // request module
let urlencode = require('urlencode'); // urlencode module
let mongoose = require('mongoose'); // mongoose module
let summonerModel = require('./model/summoner.js'); // summoner data model
let async = require('async'); // async model
let champ = require('./champion.js'); // 챔피언 static data
let spell = require('./spell.js'); // 스펠 static data
let lane = require('./lane.js'); // 포지션 구하기
let map = require('./map.js'); // 맵 좌표로 포지션 구하기

const MATCH_LENGTH = 5; // 요청할 최근 매치 개수

let indexRouter = require('./routes/index');
let usersRouter = require('./routes/users');

let app = express();
appSet();
mongoSet();

app.all('/*', function(req, res, next) { res.header("Access-Control-Allow-Origin", "*"); res.header("Access-Control-Allow-Headers", "X-Requested-With"); next(); });

function appSet(){
	// view engine setup
	app.set('views', path.join(__dirname, 'views'));
	app.set('view engine', 'jade');

	app.use(logger('dev'));
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	app.use(cookieParser());
	app.use(express.static(path.join(__dirname, 'public')));

	app.use('/', indexRouter);
	app.use('/users', usersRouter);



	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
	  next(createError(404));
	});

	// error handler
	app.use(function(err, req, res, next) {
	  // set locals, only providing error in development
	  res.locals.message = err.message;
	  res.locals.error = req.app.get('env') === 'development' ? err : {};

	  // render the error page
	  res.participantus(err.status || 500);
	  res.render('error');
	});
}

function mongoSet(){
	// mongoDB
	mongoose.connect("mongodb://127.0.0.1:27017/web", { useUnifiedTopology: true, useNewUrlParser: true });
	const db = mongoose.connection;
	db.on('error', console.error);  // mongoDB 연동 실패 시 에러 메시지 출력
	db.once('open', () =>{
	  console.log('connected to mongoDB server'); // mongoDB 연동 성공 시 메시지 출력
	});
}


// riot api
app.io = require('socket.io')();

let key = "RGAPI-cb2ec467-9587-46f6-80ea-a7a3fb4c4974"; // LOL API key
let client;

app.io.on('connection', function(socket){
	client = socket.id; 
	console.log("client id " + client + " connected");
	
	socket.on('discon', function(done){ // 모든 request가 끝나면 socket 연결 해제
		socket.disconnect();
		console.log("client id " + client + " disconnected, requests done: " + done);
	});
	
	socket.on('loadSummoner', function(name){ // 클라이언트에서 소환사 정보 불러오기 요청시
		let encodedName = encodeName(name);
		summonerModel.findOne({"encodedName": encodedName}, function(err, result){
			if(result == null){
				console.log("-------------------------------");
				console.log("no result, create summoner info");
				createSummonerInfo(name, encodedName); // db에 정보가 없을 경우 새로 생성
			}
			else{
				console.log("-------------------------------");
				console.log("found result, load all info");
				
				result = JSON.parse(JSON.stringify(result)); // query 결과를 JSON으로 파싱
				app.io.to(client).emit('db', result); // db에 정보가 있을 경우 로드
				
				console.log("all info loaded");
				console.log("-------------------------------");
			}
		}); // db에서 소환사 정보 찾기
		
	});
	

	socket.on('updateSummoner', function(name){ // 클라이언트에서 소환사 정보 갱신 요청시
		console.log("-------------------------------");
		console.log("client id " + client + " requested update");
		let encodedName = encodeName(name);
		updateSummoner(name, encodedName);
	});
	
	
	
	function createSummonerInfo(name, encodedName){ // db에 소환사 정보 생성하기
		
		let url = "https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-name/"+ encodedName +"?api_key=" + key // URL 생성
		
		let instance = new summonerModel();
		let now = Number(new Date());
		instance.created = now;
		let done = 0;
		
		function saveInstance(){ // 모든 비동기 request가 끝나면 db에 입력
			if(done==2){ // SUMMONER-V4 요청 완료 후 기다려야할 비동기 요청들 : LEAGUE-V4, MATCH-V4
				instance.save(function(err){
					if(err){
						console.log(err);
					}
				});
				console.log("db saved");
				
				console.log("-------------------------------");
			}
		}
		
		request(url, function(error, response, body) { // SUMMONER-V4
			if(error){
				console.log(error);
				app.io.to(client).emit('error', error);
			}
			else if(response.statusCode == 200){
				let result = JSON.parse(body);
				instance.name = result['name'];
				instance.encodedName = encodedName;
				instance.id = result['id'];
				instance.accountId = result['accountId'];
				instance.puuid = result['puuid'];
				instance.level = result['summonerLevel'];
				instance.icon = result['profileIconId'];
				
				app.io.to(client).emit('summoner', instance); // 클라이언트에 뿌리기
				console.log("summoner info created");
				
				getLeague(result['id']);
				getMatchList(result['puuid']);
			}
			else{
				app.io.to(client).emit('error', response.statusCode);
				console.log("error on requesting summoner-v4 : " + response.statusCode);
			}
		});
		
		
		function getLeague(id){
			
			let url = "https://kr.api.riotgames.com/lol/league/v4/entries/by-summoner/"+ id +"?api_key=" + key; // URL 생성
			
			request(url, function(error, response, body) { // LEAGUE-V4
				if(error){
					console.log(error);
				}
				else if(response.statusCode == 200){
					let result = JSON.parse(body);
					for(i=0; i<result.length; i++){
						switch(result[i].queueType){
							case 'RANKED_SOLO_5x5':
								instance.solo.tier = result[i].tier;
								instance.solo.rank = result[i].rank;
								instance.solo.point = result[i].leaguePoints;
								instance.solo.win = result[i].wins;
								instance.solo.lose = result[i].losses;
								break;
							case 'RANKED_FLEX_SR':
								instance.free.tier = result[i].tier;
								instance.free.rank = result[i].rank;
								instance.free.point = result[i].leaguePoints;
								instance.free.win = result[i].wins;
								instance.free.lose = result[i].losses;
								break;
							default:
						}
					}
					
					done++;
					saveInstance();
					
					app.io.to(client).emit('league', instance); // 클라이언트에 뿌리기
					console.log("league info created");
				}
				else{
					app.io.to(client).emit('error', response.statusCode);
					console.log("error on requesting league-v4 : " + response.statusCode);
				}
			});
		}
		
		// matchlist 기본 변수 설정
		let matchLength;
		let matchCreated = 0; // 동기화
		let timelineCreated = 0;
		function getMatchList(puuid){ // MATCH-V4_matchlist
			
			let count = MATCH_LENGTH; // 요청할 최근 매치 개수
			let url = "https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/" + puuid + "/ids" + "?start=0" + "&count=" + count + "&queue=420" + "&api_key=" + key; 
			// URL 생성
			
			request(url, function(error, response, body) {
				if(error){
					console.log(error);
				}
				else if(response.statusCode == 200){
					let result = JSON.parse(body);
					matchLength = result.length;
					for(i=0; i<matchLength; i++){
						getMatch(result[i], puuid, i);
					}
					
				}
				else{
					app.io.to(client).emit('error', response.statusCode);
					console.log("error on requesting match-v4_matchlist : " + response.statusCode);
				}
			});
		}
		
		
		function getMatch(gameId, puuid, matchIndex){ // MATCH-V4_match
			
			let url = "https://asia.api.riotgames.com/lol/match/v5/matches/" + gameId + "?api_key=" + key; // URL 생성
			
			request(url, function(error, response, body) {
				if(error){
					console.log(error);
				}
				else if(response.statusCode == 200){
					let result = JSON.parse(body);
					let info = result.info;
					
					let data = {
						gameVersion: info.gameVersion,
						gameCreation: info.gameCreation,
						gameDuration: info.gameDuration,
						userInfo:{
							userPId: Number,
							userTeam: Number,
							userName: String
						},
						player:[],
						team:[],
						jungler:[],
						teamFight: []
					};

					
					async.waterfall([ // 각 게임 상세 정보는 동기화하여 모든 매치 정보가 정리된 후 db에 입력하도록 함
						function(callback){ // 유저, 팀 정보 콜백 1번째
							
							function teamData(index){ // 팀 데이터
								let team = info.teams[index];
								return {
									teamId: team.teamId,
									win: team.win,
									firstDragon: team.firstDragon,
									firstRiftHerald: team.firstRiftHerald,
									dragonKills: team.dragonKills,
									dragon: [],
									riftHeraldKills: team.riftHeraldKills
								};
							}
							
							for(i=0; i<10; i++){
								if(info.participants[i].puuid == puuid){ // 유저 데이터 입력
									let participant = info.participants[i];
									
									data.userInfo.userPId = participant.participantId;
									data.userInfo.userName = participant.summonerName;
									data.userInfo.userTeam = participant.teamId;
									data.userInfo.userSpell1 = spell.findImage(participant.spell1Id);
									data.userInfo.userSpell2 = spell.findImage(participant.spell2Id);
									if(participant.teamId == info.teams[0].teamId){
										data.userInfo.userWin = info.teams[0].win;
									}
									else{
										data.userInfo.userWin = info.teams[1].win;
									}
									// 팀 데이터 입력
									data.team.push(teamData(0));
									data.team.push(teamData(1));

									callback();
									break;
								}
							}
						},
						function(callback){ // 플레이어, 정글러 정보 콜백 2번째
							function junglerData(index){ // 정글러 데이터
									let participant = info.participants[index];
									let teamIndex;
									if(participant.teamId == data.team[0].teamId){
										teamIndex = 0;
									}
									else{
										teamIndex = 1;
									}
									return {
										// 기본정보
										name: participant.summonerName,
										pId: participant.participantId,
										teamId: participant.teamId,
										teamIndex: teamIndex,
										champion: champ.findName(participant.championId),
										championImage: champ.findImage(participant.championId),
										spell1Image: spell.findImage(participant.spell1Id),
										spell2Image: spell.findImage(participant.spell2Id),
										item0: participant.item0,
										item1: participant.item1,
										item2: participant.item2,
										item3: participant.item3,
										item4: participant.item4,
										item5: participant.item5,
										item6: participant.item6,
										// KDA
										kill: participant.kills,
										death: participant.deaths,
										assist: participant.assists,
										kda: kda(participant.kills, participant.deaths, participant.assists),
											// 계산방식 : 킬 + 어이스트 / 데스
										largestMultiKill: participant.largestMultiKill,
										// 성장
										goldEarned: participant.goldEarned,
										champLevel: participant.champLevel,
										csPerMin: ((participant.totalMinionsKilled+participant.neutralMinionsKilled)/(result.gameDuration/60).toFixed(1)).toFixed(1),
											// 계산방식 : 미니언킬 + 정글몹킬 / 게임시간
										/*
										xpPerMin: normalize(participant.timeline.xpPerMinDeltas),
										goldPerMin: normalize(participant.timeline.goldPerMinDeltas),
										// 미니언, 정글몹
										*/
										totalCs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
											// 계산방식 : 미니언킬 + 정글몹킬
										neutralMinionsKilled: participant.neutralMinionsKilled,
										neutralMinionsKilledEnemyJungleRatio: Math.floor((participant.neutralMinionsKilledEnemyJungle / (participant.neutralMinionsKilledTeamJungle + participant.neutralMinionsKilledEnemyJungle))*100) || 0,
											// 계산방식 : 적정글몹킬 / 팀정글몹킬 + 적정글몹킬
										// 시야 기여
										visionScore: participant.visionScore,
										visionWardsBoughtInGame: participant.visionWardsBoughtInGame,
										wardsPlaced: participant.wardsPlaced,
										wardsKilled: participant.wardsKilled,
										// 딜량
										totalDamageDealt: participant.totalDamageDealt,
										damageDealtToObjectives: participant.damageDealtToObjectives,
										damageDealtToTurrets: participant.damageDealtToTurrets,
										damageSelfMitigated: participant.damageSelfMitigated,
										// CC 기여
										timeCCingOthers: participant.timeCCingOthers,
										totalTimeCrowdControlDealt: participant.totalTimeCrowdControlDealt,
										firstBloodKill: participant.firstBloodKill,
										firstBloodAssist: participant.firstBloodAssist,
										// 포지션 분포
										posTop: 0,
										posMid: 0,
										posBot: 0,
										// 별
										star: false,
									};
								}
							for(i=0; i<10; i++){
								let participant = info.participants[i];
								
								let playerData = { // 플레이어 데이터
									name: participant.summonerName,
									pId: participant.participantId,
									teamId: participant.teamId,
									champion: champ.findName(participant.championId),
									championImage: champ.findImage(participant.championId),
									spell1Image: spell.findImage(participant.spell1Id),
									spell2Image: spell.findImage(participant.spell2Id),
									kill: participant.kills,
									death: participant.deaths,
									assist: participant.assists
								}
								data.player.push(playerData);
								
								// 정글러 찾기
								if(participant.spell1Id == 11 || participant.spell2Id == 11){
									data.jungler.push(junglerData(i));
								}

							}
							
							for(let j=0; j<2; j++){
								if(data.jungler[j] == null){
									// 정글러를 찾지 못했을 경우
									data.jungler[j] = junglerData(0);
									data.error = 1;
								}
							}
							if(data.jungler[2]){
								// 정글러가 2명보다 많을 경우
							}
							
							// 별
							let starData = [];
							let score = [0, 0];
							for(let j=0; j<2; j++){
								let jungler = data.jungler[j];
								let team = data.team[jungler.teamIndex];
								starData.push([ // 보정값이 클수록 점수 차이 감소
									jungler.kda, 
									jungler.goldEarned, 
									jungler.champLevel, 
									jungler.totalCs, 
									jungler.visionScore+10, 
									jungler.totalDamageDealt, 
									jungler.damageSelfMitigated+1000,
									team.dragonKills+2,
									team.riftHeraldKills+2
								]);
							}
							for(let s in starData[0]){
								let point = valueToScore(starData[0][s], starData[1][s]);
								score[0] += point[0];
								score[1] += point[1];
							}
							score[0] = Number(score[0].toFixed(2));
							score[1] = Number(score[1].toFixed(2));
							if(score[0] > score[1]){
								data.jungler[0].star = true;
							}
							else if(score[0] < score[1]){
								data.jungler[1].star = true;
							}
							else{
								// 
							}
							matchCreated++;
							callback();
						},
						function(callback){ // MATCH-V4_timeline
							
							let url = "https://asia.api.riotgames.com/lol/match/v5/matches/" + gameId + "/timeline" + "?api_key=" + key; // URL 생성
			
							request(url, function(error, response, body) {
								if(error){
									console.log(error);
								}
								else if(response.statusCode == 200){
									let result = JSON.parse(body);
									let info = result.info;
									
									// 한타 관련 변수 설정
									let lastEvent = 0;
									let started = null;
									let ended = null;
									let killStack = 0;
									let teamFightData = {
										"started": Number,
										"ended": Number,
										"event": [],
										"participantId": []
									};
									let teamFightPlayers = Array();
									
									for(let i in info.frames){ // 각 프레임의 정보들 나열
										let frame = info.frames[i];
										if(frame.participantFrames[1].position != null){
											// 정글러의 위치를 1분마다 계산
											for(let num in frame.participantFrames){
												let participantFrames = frame.participantFrames[num];
												for(let j=0; j<2; j++){
													if(participantFrames.participantId == data.jungler[j].pId){
														switch(map.getLane(participantFrames.position.x, participantFrames.position.y)){
															case 1: 
																data.jungler[j].posTop++;
																break;
															case 2:
																data.jungler[j].posMid++;
																break;
															case 3:
																data.jungler[j].posBot++;
																break;
															default:
														}
													}
												}
											}
										}
										
										for(let index in frame.events){ // 특정 프레임의 이벤트들 나열
											let event = frame.events[index];
											if(event.type == "CHAMPION_KILL"){ // 이벤트에 킬로그가 발견될 경우
												
												if(event.timestamp > lastEvent + 15000){ 
													// 한타 종료 후 발생한 새로운 킬일 경우 이전 한타는 종료된 것으로 판단

													// 이전 한타 정보 처리
													if(teamFightPlayers.length >= 6 && killStack >= 3){ 
														// 6명 이상 관여, 3킬 이상 기록된 한타일 경우
														ended = lastEvent; // 한타가 종료된 마지막 킬 시간
														teamFightData.started = started;
														teamFightData.ended = ended;
														teamFightData.participantId = teamFightPlayers;
														
														data.teamFight.push(teamFightData);
													}
													
													// 초기화
													teamFightData = {
														"started": Number,
														"ended": Number,
														"event": [],
														"participantId": []
													};
													teamFightPlayers = Array();
													killStack = 0;
													
													
													// 새 한타 정보 처리
													lastEvent = event.timestamp; // 마지막으로 킬이 발생한 시간
													started = event.timestamp; // 새 한타의 시작시간으로 설정
													
													for(let id in event.assistingParticipantIds){
														if(teamFightPlayers.indexOf(event.assistingParticipantIds[id]) == -1){ 
															// 한타에 참여한 플레이어 목록에 어시스트 플레이어 id가 없을경우 새로 추가
															teamFightPlayers.push(event.assistingParticipantIds[id]);
														}
													}
													if(teamFightPlayers.indexOf(event.killerId) == -1){ 
														// 한타에 참여한 플레이어 목록에 킬 플레이어 id가 없을경우 새로 추가
														teamFightPlayers.push(event.killerId);
													}
													if(teamFightPlayers.indexOf(event.victimId) == -1){ 
														// 한타에 참여한 플레이어 목록에 데스 플레이어 id가 없을경우 새로 추가
														teamFightPlayers.push(event.victimId);
													}
												}
												else{ // 한타 진행중 발생한 킬일 경우 // 첫 킬에 무조건 실행됨
													lastEvent = event.timestamp; // 마지막으로 킬이 발생한 시간 갱신
													killStack++;
													for(let id in event.assistingParticipantIds){
														if(teamFightPlayers.indexOf(event.assistingParticipantIds[id]) == -1){ 
															// 한타에 참여한 플레이어 목록에 어시스트 플레이어 id가 없을경우 새로 추가
															teamFightPlayers.push(event.assistingParticipantIds[id]);
														}
													}
													if(teamFightPlayers.indexOf(event.killerId) == -1){ 
														// 한타에 참여한 플레이어 목록에 킬 플레이어 id가 없을경우 새로 추가
														teamFightPlayers.push(event.killerId);
													}
													if(teamFightPlayers.indexOf(event.victimId) == -1){ 
														// 한타에 참여한 플레이어 목록에 데스 플레이어 id가 없을경우 새로 추가
														teamFightPlayers.push(event.victimId);
													}
												}
												
												teamFightData.event.push({
													type: event.type,
													killerId: event.killerId,
													victimId: event.victimId,
													assistId: event.assistingParticipantIds,
													timestamp: event.timestamp
												});
												
												
												// 정글러의 킬, 어시스트, 데스 위치를 계산
												for(let j=0; j<2; j++){
													if(event.killerId == data.jungler[j].pId || event.victimId == data.jungler[j].pId){ // 킬 혹은 데스
														switch(map.getLane(event.position.x, event.position.y)){
															case 1: 
																data.jungler[j].posTop++;
																break;
															case 2:
																data.jungler[j].posMid++;
																break;
															case 3:
																data.jungler[j].posBot++;
																break;
															default:
														}
													}
													else{ // 어시스트
														for(let id in event.assistingParticipantIds){
															if(event.assistingParticipantIds[id] == data.jungler[j].pId){
																switch(map.getLane(event.position.x, event.position.y)){
																	case 1: 
																		data.jungler[j].posTop++;
																		break;
																	case 2:
																		data.jungler[j].posMid++;
																		break;
																	case 3:
																		data.jungler[j].posBot++;
																		break;
																	default:
																}
															}
														}
													}
												}
											}
											// 드래곤 킬 이벤트가 발견될 경우
											else if(event.type == "ELITE_MONSTER_KILL" && event.monsterType == "DRAGON"){
												for(let p in data.player){
													if(event.killerId == data.player[p].pId){
														for(let t=0; t<2; t++){
															if(data.player[p].teamId == data.team[t].teamId){
																data.team[t].dragon.push({"name": event.monsterSubType, "timestamp": event.timestamp});
																break;
															}
														}
													}
												}
											}
										}
									}
									
									timelineCreated++;
									callback();

								}
								else{
									app.io.to(client).emit('error', response.statusCode);
									console.log("error on requesting match-v4_timeline : " + response.statusCode);
								}
							});
						}
					],
						function(err){

							if(err){
								//console.log(err);
							}
							else{
								console.log(instance);
								instance.match[matchIndex].detail = data;

								if(matchCreated == matchLength && timelineCreated == matchLength){ 
									// match, timeline 모두 완료되었을때
									app.io.to(client).emit('error', response.statusCode);
									console.log("match info created");
									done++;
									saveInstance();
								}
							}
						}
					);
					
				}
				else{
					app.io.to(client).emit('error', response.statusCode);
					console.log("error on requesting match-v4_match : " + response.statusCode);
				}
			});
		}
		
		

	}
	
	function updateSummoner(name, encodedName){ // SUMMONER-V4 사용, db의 소환사 정보 갱신

		summonerModel.deleteOne({
			'encodedName': encodedName
		}, function(err, result){
			if(result.ok){
				console.log("db deleted");
				createSummonerInfo(name, encodedName);
			}
			else{
				console.log(err);
			}
		});
	}
	

});


function normalize(doc){
	let value = 0;
	let length = 0;
	for (let key in doc){
		value += doc[key];
		length++;
	}
	let result = (value/length).toFixed(1)
	return result;
}

function kda(k, d, a){
	let result = 0;
	if(d == 0){
		result = k+a;
	}
	else{
		result = (k+a)/d;
	}
	return Number(result.toFixed(2));
}

function encodeName(name){
	return urlencode(name.replace(/ /g, "").toLowerCase());
}

function valueToScore(val1, val2){
	let values = [];
	if(val1 > val2){
		values.push(1);
		values.push(Number((val2/val1).toFixed(2)));
	}
	else if(val1 < val2){
		values.push(Number((val1/val2).toFixed(2)));
		values.push(1);
	}
	else{
		values.push(1, 1);
	}
	return values;
}

module.exports = app;
