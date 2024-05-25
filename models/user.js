const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
	id: String,
	pw: String,
	creation: String,
	team: [{
		name: String,
		leader: Boolean
	}],
	admin: Boolean
});

module.exports = mongoose.model('user', userSchema);