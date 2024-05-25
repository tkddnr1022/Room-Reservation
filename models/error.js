const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var errorSchema = new Schema({
	id: String,
	msg: String,
	timestamp: String
});

module.exports = mongoose.model('error', errorSchema);