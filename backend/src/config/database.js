// Auto-selects SQLite or MySQL based on environment
// Use MySQL only when USE_MYSQL=true AND DB_HOST is set
if (process.env.USE_MYSQL === 'true' && process.env.DB_HOST) {
  module.exports = require('./database.prod');
} else {
  module.exports = require('./database.sqlite');
}
