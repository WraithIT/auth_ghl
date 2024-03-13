const moment = require('moment');

function formatDate(data) {
  return moment(data).format('YYYY-MM-DD HH:mm:ss');
}

module.exports = {
    formatDate
}