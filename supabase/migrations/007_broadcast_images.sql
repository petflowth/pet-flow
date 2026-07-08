-- รูปโปรโมชั่นสำหรับส่ง LINE broadcast (เก็บชั่วคราว)

create table if not exists broadcast_images (
  id text primary key,
  data text not null,
  content_type text not null default 'image/jpeg',
  created_at timestamptz not null default now()
);

create index if not exists broadcast_images_created_at_idx on broadcast_images(created_at);
