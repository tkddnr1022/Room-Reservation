import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/reserve.css';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import Axios from 'axios';

import * as Time from '../scripts/time.js';

function Reservation() {
  return (
		<div className="d-flex flex-column min-vh-100 justify-content-center align-items-center">
		  <Button primary onClick={requestHandler}>신청</Button>
			<Table bordered size="sm">
				<thead>
					<tr>
						<th>시간</th>
						<td>월</td>
						<td>화</td>
						<td>수</td>
						<td>목</td>
						<td>금</td>
						<td>토</td>
						<td>일</td>
					</tr>
				</thead>
				<tbody dangerouslySetInnerHTML={ {__html: Time.TimeRow()} }>
				</tbody>
			</Table>
		</div>
  );
}

function requestHandler(time){
	console.log("clicked");
	Axios.post('../scripts/reserve_request.js');
}

export default Reservation;
