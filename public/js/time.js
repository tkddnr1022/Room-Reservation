export function TimeRow(){
	let elem = "";
	let time = {h : 9, m : 0};
	while(time.h < 24){
		let row = "<tr><th>";
		
		row += Term(time) + " ~ ";
		time.m += 30;
		row += Term(time);
		
		for(let i=0; i<7; i++){
			row+="<td index='"+time.h+time.m+i+"'></td>";
		}
		row += "</tr>";
		elem += row;
	}
	
	return elem;
}

export function Term(t){
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