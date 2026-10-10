create table users (
  id integer primary key autoincrement,
  email text not null unique,
  name text not null,
  password_hash text not null
);
