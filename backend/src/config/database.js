// Auto-selects SQLite (local dev) or MySQL (production)
if (process.env.NODE_ENV === 'production' || process.env.USE_MYSQL === 'true') {
  module.exports = require('./database.prod');
} else {
  module.exports = require('./database.sqlite');
}
