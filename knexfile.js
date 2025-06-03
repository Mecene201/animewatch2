/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      // point at your actual DB path under /data
      filename: './data/anime.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    }
  },

  staging: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: { min: 2, max: 10 },
    migrations: { tableName: 'knex_migrations' }
  },

  production: {
    client: 'postgresql',
    connection: {
      database: 'my_db',
      user:     'username',
      password: 'password'
    },
    pool: { min: 2, max: 10 },
    migrations: { tableName: 'knex_migrations' }
  }

};
