create table albums (
  id integer primary key autoincrement,
  slug text not null unique,
  title text not null,
  artist text not null,
  year integer not null,
  genre text not null,
  notes text not null
);

create index albums_slug_idx on albums (slug);
