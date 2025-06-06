const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  subject: String,
  chapter: String,
  class: String,
  unit: String,
  status: String,
  isWeakChapter: Boolean,
  questionSolved: Number,
  yearWiseQuestionCount: {
    type: Map,
    of: Number
  }
}, { timestamps: true });

module.exports = mongoose.model('Chapter', chapterSchema);
