exports.up = function(knex) {
  // 1) add the column with default 0
  // 2) backfill existing rows so position = episodeNumber
  return knex.schema.table('episodes', table => {
    table.integer('position').notNullable().defaultTo(0);
  })
  .then(() => {
    // ← use knex.ref to point at the real column name
    return knex('episodes')
      .update('position', knex.ref('episodeNumber'));
  });
};

exports.down = function(knex) {
  // remove the column on rollback
  return knex.schema.table('episodes', table => {
    table.dropColumn('position');
  });
};
