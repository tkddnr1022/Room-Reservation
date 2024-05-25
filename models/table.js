const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var tableSchema = new Schema({
	teamName: String,
	leader: String,
	index: [Number],
	timestamp: String
});

module.exports = mongoose.model('table', tableSchema);