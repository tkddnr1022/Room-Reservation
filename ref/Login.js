import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import Form from "react-bootstrap/Form"; 
import Button from "react-bootstrap/Button";
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

let btn = {
	width : "5rem"	
};

function Login() {
  return (
	  <div className="d-flex flex-column min-vh-100 justify-content-center align-items-center">
		  <Card>
			<Form style={{margin:"20px"}}>
			  <Form.Group className="mb-3" controlId="formBasicEmail">
				<Form.Label>이름</Form.Label>
				<Form.Control type="textarea" placeholder="이름" />
			  </Form.Group>

			  <Form.Group className="mb-3" controlId="formBasicPassword">
				<Form.Label>비밀번호</Form.Label>
				<Form.Control type="password" placeholder="4자리" />
			  </Form.Group>
				<Row>
					<Col className="text-center">
						<Button variant="primary" style={btn} type="submit">
						로그인
					  </Button>
					</Col>
					<Col className="text-center">
						<Button variant="secondary" style={btn} href="">
						등록
						</Button>
					</Col>
				</Row>
			</Form>
		  </Card>
	  </div>
  );
}

export default Login;