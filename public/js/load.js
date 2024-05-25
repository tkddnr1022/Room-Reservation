function TimeRow(){
	let elem = "";
	let time = {h : 9, m : 0};
	let index = 0;
	while(time.h < 24){
		let row = "<tr><th>";
		
		row += Term(time) + " ~ ";
		time.m += 30;
		row += Term(time);
		
		for(let i=0; i<7; i++){
			row+="<td class='empty' index='"+index+"'></td>";
			index++;
		}
		row += "</tr>";
		elem += row;
	}
	
	return elem;
}

function Term(t){
	let str = "";
	if(t.m >= 60){
		t.m-=60;
		t.h++;
	}
	if(t.h<10) str += "0";
	str += t.h+":";
	if(t.m<10) str += "0";
	str += t.m;
	
	return str;
}

$( document ).ready(function() {
	let socket = io();
	let admin = false;
	let id = '';
	
	let page_login = $('#page_login');
	let page_reserve = $('#page_reserve');
	let timeline = $('#timeline');
	let loading_bar = $('#loading_bar');
	let teamlist = $('#teamlist');
	let selected_team = "";
	let selected_index = [];
	let selected_index_backup = [];
	let token = localStorage.getItem('token');
	
	socket.emit('verify_token', token);
	
	function showPage(team){
		page_login.hide();
		timeline.append(TimeRow());
		
		let firstItem = true;
		for(key in team){
			if(team[key].leader){
				selected_index.push({'teamName': team[key].name, 'index': []});
				if(firstItem){
					teamlist.append("<li class='list-group-item list-group-item-action active'>"+team[key].name+"</li>");
					selected_team = team[key].name;
					firstItem = false;
				}
				else teamlist.append("<li class='list-group-item list-group-item-action'>"+team[key].name+"</li>");
			}
		}
		selected_index_backup = JSON.parse(JSON.stringify(selected_index));
		page_reserve.show();
	}
	
	function hidePage(){
		page_reserve.hide();
		timeline.children().remove();
		teamlist.children().remove();
		page_login.show();
	}
	
	$( document ).on('click', '#btn_login', function(){
		let id = $('#input_id')[0].value;
		let pw = $('#input_pw')[0].value;
		let data = {"id": id, "pw": pw};
		
		socket.emit('login', data);
	});
	
	$( document ).on('click', '#btn_logout', function(){
		localStorage.clear();
		
		selected_team = "";
		selected_index = [];
		
		socket.emit('logout');
		hidePage();
	});
	
	$( document ).on('click', '#teamlist li', function(){
		let parent = $(this).parent();
		parent.children().removeClass('active');
		$(this).addClass('active');
		selected_team = $(this).html();
	});
	
	// 시간 선택
	$( document ).on('click', '#timeline tr td', function(){
		let cell = $(this);
		if(cell.hasClass('table-secondary') && !admin) return;
		let index = Number(cell.attr('index'));
		let teamName = cell.html();
		let temp = true;
		
		if(teamName){ // 시간 지우기
			cell.html('');
			selected_index.find(function(t){
				if(t.teamName == teamName){
					t.index = t.index.filter(function(i){
						return i != index;
					});
				}
			});
		}
		else{ // 시간 추가하기
			// 오브젝트에 팀이름별로 분류하여 인덱스 추가
			selected_index.find(function(t){
				if(t.teamName == selected_team){
					if(t.index.length > 5){
						console.log("시간 상한 초과");
						temp = false;
					}
					else{
						t.index.push(index);
						cell.html(selected_team);
					}
					return;
				}
			});
		}
		
		if(temp){
			cell.toggleClass('table-primary');
			cell.toggleClass('empty');
		}
		
		console.log(selected_index);
	});
	
	$( document ).on('click', '#btn_reserve', function(){
		let count = 0;
		for(i in selected_index){
			count += selected_index[i].index.length
		}
		console.log(count);
		if(count == 0){
			$('#alert_fail').stop(true, true).fadeIn(300).delay(3000).fadeOut(400);
			return;
		}
		let auth;
		if(admin) auth = 'admin';
		else auth = 'leader';
		socket.emit('request_reserve', {'id': id, 'auth': auth, 'data': selected_index, 'token': token});
	});
	
	socket.on('debug', function(msg){
		console.log(msg);
	});
	
	socket.on('login_response', function(data){
		if(data.valid){
			localStorage.setItem('id', data.id)
			localStorage.setItem('team', JSON.stringify(data.team))
			localStorage.setItem('token', data.token);
			admin = data.admin;
			id = data.id;
			showPage(data.team);
		}
		else{
			console.log("incorrect id or pw");
		}
	});
	
	socket.on('verify_token_response', function(res){
		if(res.valid) {
			loading_bar.hide();
			admin = res.admin;
			id = res.id;
			showPage(JSON.parse(localStorage.getItem('team')));
		}
		else{
			loading_bar.hide();
			page_login.show();
		}
	});
	
	socket.on('request_reserve_response', function(data){
		console.log(data.result);
		console.log(data.msg);
		let cell = $('.table-primary');
		cell.removeClass('table-primary');
		if(data.result){
			cell.addClass('table-secondary');
			$('#alert_success').fadeIn(300).delay(3000).fadeOut(400);
		}
		else{
			cell.addClass('empty');
			cell.html('');
			$('#alert_fail').fadeIn(300).delay(3000).fadeOut(400);
		}
		selected_index = JSON.parse(JSON.stringify(selected_index_backup));
	});
	
	socket.on('send_table', function(data){
		for(i in data){
			let team_db = data[i];
			for(j in team_db.index){
				let index = team_db.index[j];
				let cell = $('[index='+index+']');
				// 선택한 시간에 신청이 들어왔을 경우
				if(cell.hasClass('table-primary')){
					let teamName = cell.html();
					// 해당 팀 신청 정보 모두 삭제
					selected_index.find(function(t){
						if(t.teamName == teamName){
							t.index = t.index.filter(function(i){
								let c = $('[index='+i+']');
								c.html('');
								c.removeClass('table-primary');
								c.addClass('empty');
							});
						}
					});
					$('#alert_duplicated').fadeIn(300).delay(3000).fadeOut(400);
				}
				cell.html(team_db.teamName);
				cell.removeClass('empty');
				cell.addClass('table-secondary');
			}
		}
	});
});
