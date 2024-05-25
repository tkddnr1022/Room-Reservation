$( document ).ready(function() {
	let matchLength;
		
	// DOM 정의
	const indexwrap = $('.indexwrap');
	const resultwrap = $('.resultwrap');
	const result = $('.result');
	const loaderwrap = $('.loaderwrap');
	const loader = $('.loader');
	const loadertext = $('.loadertext');
	const alert = $('.alert');
	const urlbox = $('.url')[0];
	const updatetip = $('.update').children('.tooltiptext');
	const copytip = $('.copy').children('.tooltiptext');
	const matchListDom = $('.matchlist');
	const matchDom = $('#match').html();
	const timelineDom = {
		element: $('#timeline-element').html(),
		content: $('#timeline-content').html(),
		champion: $('#timeline-champion').html(),
		assist: $('#timeline-assist').html(),
		message: $('#timeline-message').html()
	};

	// 쿼리 체크
	const query = get_query().name
	if(query){
		emitEvent('loadSummoner', query);
		indexwrap.hide();
		resultwrap.fadeIn();
	}
	else{
		indexwrap.show();
	}

	// 알림 표시
	function showAlert(msg, status, time){
		alert.text(msg);
		alert.removeClass();
		alert.addClass('container');
		alert.addClass('alert');
		alert.addClass('alert-'+status);
		alert.fadeIn();
		setTimeout(function(){
			alert.fadeOut();
		}, time);
	}

	alert.on('click', function(){
		$(this).fadeOut();
	});

	// 소환사 검색
	$("form").on("submit", function(event) {
		event.preventDefault();

		let name = $(".searchbar")[0].value;
		if(name == ""){
			return errMsg();
		}

		emitEvent('loadSummoner', name);

		indexwrap.fadeOut();
		indexwrap.addClass('slideout');
		resultwrap.fadeIn();
		resultwrap.addClass('slidein');
	});

	// 갱신
	$(".updatebtn").on('click', function(){
		if($(this).hasClass('active')){

		}
		else{
			$(this).addClass('active');
			updatetip.addClass('expend');
			updatetip.text('갱신중..');
			$('.fa-sync-alt').addClass('spin');
			emitEvent('updateSummoner', $('#name').text());
		}
	});

	// url 클립보드에 복사
	$('.copybtn').on('click', function(){
		urlbox.value = location.href;
		urlbox.select();
		document.execCommand('Copy');
		copytip.addClass('expend');
		copytip.text("복사 성공!");
	});

	$('.copybtn').hover(function(){
		copytip.removeClass('expend');
		copytip.text("복사");
	}, function(){

	});
	
	// 매치 상세정보에서 탭 전환
	$( document ).on('click', '.tap', function(){
		let detailIndex = $(this).data('index');
		let detail = $('.matchdetail:eq(' + detailIndex + ')');
		detail.find('.tap-sm').toggleClass('active');
		detail.find('.tap-tf').toggleClass('active');
		detail.children('.detail-sm').toggle();
		detail.children('.detail-tf').toggle();
	});

	// 자세히 보기
	$( document ).on('click', '.detailbtn', function(){
		let detailIndex = $(this).data('index');
		let detail = $('.matchdetail:eq(' + detailIndex + ')');
		detail.toggleClass('out');
		detail.toggleClass('in');
		$(this).children('.detailicon').toggleClass('fa-angle-up');
		$(this).children('.detailicon').toggleClass('fa-angle-down');
		$(this).children('.detailtext').text($(this).children('.detailtext').text() == "간략히" ? "자세히" : "간략히");
		if(detail.find('.detailchart').hasClass('unloaded')){
			let ctx = detail.find('.detailchart');
			ctx.removeClass('unloaded');
			let detailChart = new Chart(ctx, {
				type: 'horizontalBar',
				data: chartData[detailIndex],
				options: options(detailIndex)
			});
		}
		if(detail.find('.poschart').hasClass('unloaded')){
			for(let p=0; p<2; p++){
				let ctx = detail.find('.poschart:eq('+p+')');
				ctx.removeClass('unloaded');
				let posChart = new Chart(ctx, {
					type: 'radar',
					data: posChartData[detailIndex][p],
					options: {
						responsive: false,
						maintainAspectRatio: false,
						legend: {
							display: false
						},
						scale: {
							ticks: {
								display: false,
								beginAtZero: true,
								suggestedMin: 0,
								suggestedMax: 80
							},
							pointLabels: {
								fontSize: 13,
								fontColor: '#CED0DA'
							}
						},
						tooltips: {
							displayColors: false,
							callbacks: {
								title: function(tooltipItem, data){
									return data.labels[tooltipItem[0].index];
								},
								label: function(tooltipItem, data) {
									return tooltipItem.value + "%";
								}
							}
						}
					}
				});
			}
		}
	});
	
	let chartData = [];
	let originalData = [];
	let posChartData = [];
	Chart.Tooltip.positioners.custom = function(elements, eventPosition) {
		return eventPosition;
		// 마우스 위치에 툴팁 표시하는 커스텀 정의
	};
	function options(matchIndex){
		return {
			responsive: true,
			maintainAspectRatio: false,
			aspectRatio: 1.1,
			scales: {
				xAxes: [
					{
						stacked: false,
						ticks: {
							min: -1,
							max: 1,
							beginAtZero: true,
							display: false
						}
					}
				],
				yAxes: [
					{
						barThickness: 15,
						stacked: true,
						ticks: {
							beginAtZero: true,
							fontColor: '#CED0DA'
						},
						position: "left"
					}
				],
			},
			legend: {
				display: false
			},
			tooltips: {
				displayColors: false,
				position: 'custom',
				callbacks: {
					label: function(tooltipItem, data) {
						let label = data.datasets[tooltipItem.datasetIndex].label;
						label += (": " + originalData[matchIndex][tooltipItem.datasetIndex][tooltipItem.index]);
						return label;
					}
				}
			}
		};
	}

	// 서버에 데이터 요청
	function emitEvent(action, name) {
		//	현재시간
		now = Number(new Date());
		let done = 0;
		let events = 2; //- 완료를 기다릴 이벤트 : league, match
		let socket = io();
		socket.emit(action, name); //- 서버로부터 정보 불러오기 위해 emit

		function discon() {
			// 소켓 통신 종료 후 동작
			if (done == events) {
				//- 완료를 기다릴 이벤트 : league, match
				// 각 차트에 unloaded 클래스 추가
				for (let i = 0; i < matchLength; i++) {
					$('.detailicon:eq('+i+')').removeClass('fa-angle-up');
					$('.detailicon:eq('+i+')').addClass('fa-angle-down');
					$('.detailtext:eq('+i+')').text('자세히');
					$('.matchdetail:eq('+i+')').removeClass('in');
					$('.matchdetail:eq('+i+')').addClass('out');
					for (let p = 0; p < 2; p++) {
						$('.poschart:eq(' + (p + i * 2) + ')').addClass('unloaded');
					}
					$('.detailchart:eq(' + i + ')').addClass('unloaded');
				}
				loaderwrap.fadeOut();
				$('.fa-sync-alt').removeClass('spin');
				if(action == 'updateSummoner'){
					$('.updatebtn').removeClass('active');
					updatetip.removeClass('expend');
					updatetip.text('갱신');
					showAlert('갱신 완료!', 'success', 1500);
				}
				result.fadeIn();
				socket.emit('discon', done);
			}
		}

		socket.on('error', function (err) {
			loader.hide();
			loadertext.text("에러: " + err);
		});

		socket.on('db', function (data) {
			loadSummonerInfo(data);
			loadRankInfo(data);
			loadMatchInfo(data);

			done = events;
			discon();
		});

		socket.on('summoner', function (data) {
			//- 기본 정보 얻기
			loadSummonerInfo(data);
		});

		socket.on('league', function (data) {
			//- 랭크 정보 얻기
			loadRankInfo(data);

			done++;
			discon();
		});

		socket.on('match', function (data) {
			//- 기본 정보 얻기
			loadMatchInfo(data);

			done++;
			discon();
		});
	}

	/* 데이터 대입 */
	function loadSummonerInfo(data) {
		// 기본 정보
		$('#name').text(data.name);
		$('#level').text(data.level);
		$('.icon').attr(
			'src',
			'http://ddragon.leagueoflegends.com/cdn/' +
				recentVersion +
				'/img/profileicon/' +
				data.icon +
				'.png'
		);
	}

	function loadRankInfo(data) {
		// 랭크 정보
		if (data.solo != null) {
			$('.soloimg').attr('src', '/images/tier/' + data.solo.tier + '.png');
			$('#soloTier').text(upToLow(data.solo.tier) + ' ' + romToNum(data.solo.rank));
			$('#soloPoint').text(data.solo.point);
			$('#soloWin').text(data.solo.win);
			$('#soloLose').text(data.solo.lose);
			$('#icon').attr('tier', data.solo.tier);
		} else {
			$('.soloimg').attr('src', '/images/tier/UNDEFINED.png');
			$('#soloTier').text('배치');
		}

		if (data.free != null) {
			$('.freeimg').attr('src', '/images/tier/' + data.free.tier + '.png');
			$('#freeTier').text(upToLow(data.free.tier) + ' ' + romToNum(data.free.rank));
			$('#freePoint').text(data.free.point);
			$('#freeWin').text(data.free.win);
			$('#freeLose').text(data.free.lose);
		} else {
			$('.freeimg').attr('src', '/images/tier/UNDEFINED.png');
			$('#freeTier').text('배치');
		}
	}

	function loadMatchInfo(data) {
		matchLength = data.match.length;
		$('.matchlength').text(matchLength);

		// 스탯 객체
		let stat = {
			junglePlayed: 0,
			jungleWins: 0,
			firstDragons: 0,
			firstRiftHeralds: 0,
			dragonKills: 0,
			totalKdas: 0,
			stars: 0
		};

		// 매치 정보
		for (let i = 0; i < matchLength; i++) {

			matchListDom.append(matchDom); // 불러온 매치 개수만큼 dom 생성
			$('.detailbtn:eq('+i+')').data('index', i);
			$('.tap-sm:eq('+i+')').data('index', i);
			$('.tap-tf:eq('+i+')').data('index', i);

			let match = $('.match:eq(' + i + ')');
			let matchdetail = $('.matchdetail:eq(' + i + ')');
			let matchData = data.match[i];
			let version = cdnVersion(data.match[i].detail.gameVersion);

			// 게임 결과
			let wininfo = match.children('.wininfo');
			if(matchData.detail.userInfo.userWin == "Win"){
				wininfo.children('.win').text("승리");
				match.addClass('win');
			}
			else{
				wininfo.children('.win').text("패배");
				match.addClass('lose');
			}
			// 게임 시간
			let gameinfo = match.children('.gameinfo');
			gameinfo.children('.timestamp').text(timeDiff(matchData.detail.gameDuration*1000 + matchData.detail.gameCreation) + '전');
			gameinfo.children('.gameDuration').text(secToDate(matchData.detail.gameDuration));

			// 유저 챔피언
			let userinfo = match.children('.userinfo');
			userinfo
				.children('.userwrap')
				.children('.user')
				.children('.champion')
				.attr(
					'src',
					'http://ddragon.leagueoflegends.com/cdn/' +
						recentVersion +
						'/img/champion/' +
						matchData.championImage
				);

			// 유저 스펠
			let spell = userinfo.children('.userwrap').children('.userspell');
			spell.children('.spell1').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' + version + '/img/spell/' + matchData.detail.userInfo.userSpell1);
			spell.children('.spell2').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' + version + '/img/spell/' + matchData.detail.userInfo.userSpell2);

			// 유저 kda, 플레이어
			let playerinfo0 = match.children('.playerinfo:eq(0)');
			let playerinfo1 = match.children('.playerinfo:eq(1)');
			for (let p=0; p<10; p++) {
				let userFound = false;
				if (!userFound && matchData.detail.player[p].pId == matchData.detail.userInfo.userPId) {
					userinfo
						.children('.userKda')
						.text(
							matchData.detail.player[p].kill +
								' / ' +
								matchData.detail.player[p].death +
								' / ' +
								matchData.detail.player[p].assist
						);
				}

				if(p<5){
					playerinfo0.children('.player:eq('+p+')').children('.championimage').children('.champion').attr('src',
						'http://ddragon.leagueoflegends.com/cdn/' +
							version +
							'/img/champion/' +
							matchData.detail.player[p].championImage
					);
					playerinfo0.children('.player:eq('+p+')').children('.name').children('.overflow').text(matchData.detail.player[p].name);
				}
				else{
					playerinfo1.children('.player:eq('+(p-5)+')').children('.championimage').children('.champion').attr('src',
						'http://ddragon.leagueoflegends.com/cdn/' +
							version +
							'/img/champion/' +
							matchData.detail.player[p].championImage
					);
					playerinfo1.children('.player:eq('+(p-5)+')').children('.name').children('.overflow').text(matchData.detail.player[p].name);
				}

			}

			// 정글
			if(matchData.detail.error == 1){
				match.hide();
				matchdetail.hide();
				showAlert('일부 매치에서 정글러를 찾지 못하여 표시하지 않았습니다.', 'warning', 4000);
				console.log('could not find jungler(index:'+i+')');
			}
			for(let j=0; j<2; j++){
				let jg = matchData.detail.jungler[j];
				let team = matchData.detail.team[jg.teamIndex];

				let junglerinfo = match.children('.junglerinfo:eq('+ j + ')').children('.jungler');
				junglerinfo.children('.champion').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' +
							version +
							'/img/champion/' +
							jg.championImage);
				junglerinfo.children('.name').text(jg.name);

				// 자세히 보기
				let detailinfo = matchdetail.find('.detailinfo:eq('+ j + ')');
				if(team.win == 'Win'){
					detailinfo.addClass('win');
				}
				else{
					detailinfo.addClass('lose');
				}

				let junglerdetail = detailinfo.find('.junglerdetail');
				junglerdetail.find('.champion').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' +
							version +
							'/img/champion/' +
							jg.championImage);
				junglerdetail.find('.champion').removeClass('mvp');
				junglerdetail.find('.star').hide();
				if(jg.star){
					junglerdetail.find('.champion').addClass('mvp');
					junglerdetail.find('.star').show();
				}

				detailinfo.find('.name').text(jg.name);

				let spell = junglerdetail.find('.junglerspell');
				spell.children('.spell1').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' + version + '/img/spell/' + jg.spell1Image);
				spell.children('.spell2').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' + version + '/img/spell/' + jg.spell2Image);

				let badgeinfo = matchdetail.find('.badgeinfo:eq('+ j + ')');
				badgeinfo.children().remove();
				if(jg.largestMultiKill>1){
					let badge = $('<span class="badge">');
					let multiKill;
					badge.addClass('badge-kill');
					switch(jg.largestMultiKill){
						case 2:
							multiKill = '더블킬';
							break;
						case 3:
							multiKill = '트리플킬';
							break;
						case 4:
							multiKill = '쿼드라킬';
							break;
						case 5:
							multiKill = '펜타킬';
							break;
					}
					badge.text(multiKill);
					badgeinfo.append(badge);
				}
				if(jg.firstBloodKill){
					let badge = $('<span class="badge">');
					badge.addClass('badge-kill');
					badge.text('선취점');
					badgeinfo.append(badge);
				}
				if(jg.firstBloodAssist){
					let badge = $('<span class="badge">');
					badge.addClass('badge-assist');
					badge.text('선취점어시');
					badgeinfo.append(badge);
				}
				if(team.firstDragon){
					let badge = $('<span class="badge">');
					badge.addClass('badge-object');
					badge.text('첫용');
					badgeinfo.append(badge);
				}
				if(team.firstRiftHerald){
					let badge = $('<span class="badge">');
					badge.addClass('badge-object');
					badge.text('첫전령');
					badgeinfo.append(badge);
				}

				let dragoninfo = matchdetail.find('.dragoninfo:eq('+j+')');
				dragoninfo.children().remove();
				for(let d in team.dragon){
					let dragon = $('<img class="dragon">');
					dragon.attr('src', '/images/dragon/' + team.dragon[d].name + '.png');
					dragoninfo.append(dragon);
				}

				let kda = detailinfo.find('.kda');
				kda.text(jg.kill + ' / ' + jg.death + ' / ' + jg.assist);

				let ratio = detailinfo.find('.ratio');
				ratio.text(' ' + (jg.kda).toFixed(1));
				ratio.removeClass('ratio-high');
				ratio.removeClass('ratio-medium');
				ratio.removeClass('ratio-low');
				if(jg.kda >= 3){
					ratio.addClass('ratio-high');
				}
				else if(jg.kda >= 2){
					ratio.addClass('ratio-medium');
				}
				else{
					ratio.addClass('ratio-low');
				}

				let iteminfo = detailinfo.find('.iteminfo');
				for(let item=0; item<7; item++){
					let itemIndex = 'item' + item;
					let itemDom = iteminfo.children('.item:eq('+item+')');
					if(jg[itemIndex] == 0){
						itemDom.attr('src', '/images/blank.png');
					}
					else{
						itemDom.attr('src', 'http://ddragon.leagueoflegends.com/cdn/'+version+'/img/item/'+jg[itemIndex]+'.png');
					}
					itemDom.on('error', function(){
						$(this).attr('src', '/images/blank.png');
					});
				}

				// 스탯 정보 저장
				if(jg.pId == matchData.detail.userInfo.userPId){
					stat.junglePlayed++;
					if(team.win == 'Win'){
						stat.jungleWins++;
					}
					if(team.firstDragon){
						stat.firstDragons++;
					}
					if(team.firstRiftHerald){
						stat.firstRiftHeralds++;
					}
					for(let d in team.dragon){
						stat.dragonKills++;
					}
					if(jg.star){
						stat.stars++;
					}
					stat.totalKdas += jg.kda;
				}
			}
			
			// 한타 정보
			let teamFightData = matchData.detail.teamFight;
			let userId = matchData.detail.userInfo.userPId;
			let color;
			if(userId < 6){
				color = function(id){
					if(id < 6){
						return 'friendly';
					}
					return 'enemy';
				}
			}
			else{
				color = function(id){
					if(id < 6){
						return 'enemy';
					}
					return 'friendly';
				}
			}
			let timeline = matchdetail.children('.detail-tf').children('.timeline');
			let elementIndex = 0;
			for(var tf in teamFightData){
				// 변수 선언
				let element, content;
				let contentIndex = 0;
				
				// 한타 정보 추가
				timeline.append(timelineDom.element);
				element = timeline.children('.timeline-element:eq('+elementIndex+')');
				elementIndex++;
				
				// 한타 시작시간 추가
				element.append(timelineDom.content);
				content = element.children('.timeline-content:eq('+contentIndex+')');
				content.children('.timeline-time').text(timeToDate(teamFightData[tf].started));
				content.children('.timeline-title').text('한타 시작');
				contentIndex++;
				
				// 한타 이벤트 추가
				for(var e in teamFightData[tf].event){
					let teamFightEvent = teamFightData[tf].event[e]
					let killerId = teamFightEvent.killerId;
					let victimId = teamFightEvent.victimId;
					let assistId = teamFightEvent.assistId;
					element.append(timelineDom.content);
					content = element.children('.timeline-content:eq('+contentIndex+')');
					content.children('.timeline-time').text(timeToDate(teamFightEvent.timestamp));
					let title = content.children('.timeline-title');
					
					// 킬 플레이어
					if(killerId == 0){
						title.append(timelineDom.champion);
						title.children('.timeline-champion:eq(0)')
					}
					else {
						title.append(timelineDom.champion);
						title.children('.timeline-champion:eq(0)').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' +
							version +
							'/img/champion/' +
							matchData.detail.player[killerId-1].championImage);
						title.children('.timeline-champion:eq(0)').addClass(color(killerId));
					}
					
					title.append(timelineDom.message);
					title.children('.timeline-message').text(' 킬 ');
					
					// 데스 플레이어
					title.append(timelineDom.champion);
					title.children('.timeline-champion:eq(1)').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' +
							version +
							'/img/champion/' +
							matchData.detail.player[victimId-1].championImage);
					title.children('.timeline-champion:eq(1)').addClass(color(victimId));
					
					// 어시스트 플레이어
					if(assistId.length){
						for(var id in assistId){
							title.append(timelineDom.assist);
							title.children('.timeline-assist:eq('+id+')').attr('src', 'http://ddragon.leagueoflegends.com/cdn/' +
								version +
								'/img/champion/' +
								matchData.detail.player[assistId[id]-1].championImage);
						}
					}

					contentIndex++;
				}
				
				// 한타 종료시간 추가
				element.append(timelineDom.content);
				content = element.children('.timeline-content:eq('+contentIndex+')');
				content.children('.timeline-time').text(timeToDate(teamFightData[tf].ended));
				content.children('.timeline-title').text('한타 종료');
				contentIndex++;
			}

			// 비교 차트 정보 저장
			let datasets = [];
			let originals = [];
			for(let j=0; j<2; j++){
				let jg = matchData.detail.jungler[j];
				let map = 1;
				if(j==0){
					map = -1;
				}
				datasets.push({
					label: jg.name,
					backgroundColor: [],
					borderWidth: 0,
					barThickness: 10,
					data: [
						map*jg.kda/12,
						map*jg.goldEarned/25000,
						map*jg.champLevel/18,
						map*jg.totalCs/400,
						map*jg.visionScore/50,
						map*jg.totalDamageDealt/300000,
						map*jg.damageSelfMitigated/50000,
						map*jg.timeCCingOthers/100
					]
				});
				originals.push([
					(jg.kda).toFixed(1),
					jg.goldEarned,
					jg.champLevel,
					jg.totalCs,
					jg.visionScore,
					jg.totalDamageDealt,
					jg.damageSelfMitigated,
					jg.timeCCingOthers
				]);
			}
			// 막대 색 설정
			let winColor = "#27964b";
			let loseColor = "#5e5f65";
			let drawColor = "#5e5f65";
			for(let value in datasets[0].data){
				if(-datasets[0].data[value] > datasets[1].data[value]){
					datasets[0].backgroundColor.push(winColor);
					datasets[1].backgroundColor.push(loseColor);
				}
				else if(-datasets[0].data[value] < datasets[1].data[value]){
					datasets[0].backgroundColor.push(loseColor);
					datasets[1].backgroundColor.push(winColor);
				}
				else{
					datasets[0].backgroundColor.push(drawColor);
					datasets[1].backgroundColor.push(drawColor);
				}
			}

			chartData.push({
				labels: ['KDA', '골드 획득', '챔피언 레벨', 'CS', '시야 점수', '딜량', '딜감소량', 'CC기여도'],
				datasets: datasets
			});
			originalData.push(originals);

			// 포지션 차트 정보 저장
			let posDatasets = [];
			for(let j=0; j<2; j++){
				let posData = [matchData.detail.jungler[j].posTop, matchData.detail.jungler[j].posMid, matchData.detail.jungler[j].posBot];
				let sum = posData[0] + posData[1] + posData[2];
				posDatasets.push([{
					borderColor: "#b2b4bd",
					backgroundColor: "#7d7f877a",
					pointBackgroundColor: "#b2b4bd",
					data: [
						Math.floor((posData[0] / sum)*100),
						Math.floor((posData[1] / sum)*100),
						Math.floor((posData[2] / sum)*100)
					]
				}]);
			}
			posChartData.push([{
				labels: ['탑', '미드', '봇'],
				datasets: posDatasets[0]
			},
			{
				labels: ['탑', '미드', '봇'],
				datasets: posDatasets[1]
			}]);				

		}

		// 스탯 
		$('.jungleplayed').text(stat.junglePlayed);

		let statChartOption = {
			legend: false,
			tooltips: {
				displayColors: false
			}
		};

		let statChartPlugin = {
			beforeDraw: function(chart) {
				let width = chart.chart.width,
					height = chart.chart.height,
					ctx = chart.chart.ctx;

				let value = chart.config.data.datasets[0].data;
				let text, fontSize;
				if(stat.junglePlayed){ // 정글 기록이 있을 경우
					text = Math.floor((value[0]/(value[0]+value[1]))*100) + '%';
					fontSize = (height / 114).toFixed(2);
				}
				else{
					text = '기록없음';
					fontSize = (height / 150).toFixed(2);
				}

				ctx.font = fontSize + "em sans-serif";
				ctx.fillStyle = '#CED0DA';
				ctx.textBaseline = "middle";

				let textX = Math.round((width - ctx.measureText(text).width) / 2),
					textY = height / 2;

				ctx.fillText(text, textX, textY);
			}
		};

		function statChart(name, label1, label2){
			if(stat.junglePlayed){ // 정글 기록이 있을 경우
				return {
					type: 'doughnut',
					data: {
						datasets: [{
							data: [stat[name], stat.junglePlayed-stat[name]],
							borderWidth: 0,
							backgroundColor: ['#2b2f52', '#522b2b']
						}],
						labels: [
							label1, 
							label2
						]
					},
					options: statChartOption,
					plugins: statChartPlugin
				};
			}
			else{
				return {
					type: 'doughnut',
					data: {
						datasets: [{
							data: [1],
							borderWidth: 0,
							backgroundColor: ['#5e5f65']
						}],
						labels: [
							''
						]
					},
					options: {
						legend: false,
						tooltips: false
					},
					plugins: statChartPlugin
				};
			}
		}

		let winRateChart = new Chart($('.stat-chart-winrate'), statChart('jungleWins', '승리', '패배'));	
		let starRateChart = new Chart($('.stat-chart-starrate'), statChart('stars', '우세', '열세'));
		let fisrtDragonChart = new Chart($('.stat-chart-firstdragon'), statChart('firstDragons', '성공', '실패'));
		let firstRiftChart = new Chart($('.stat-chart-firstrift'), statChart('firstRiftHeralds', '성공', '실패'));

		console.log(stat); // Debug
		console.log(data); // Debug
	}

});