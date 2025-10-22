-- Dev seed users; passwords set via script later
INSERT INTO users(email, name, pass_hash, role) VALUES
('admin@example.com','Admin','__TO_SET__','admin')
ON CONFLICT (email) DO NOTHING;
INSERT INTO users(email, name, pass_hash, role) VALUES
('vertrieb@example.com','Vertrieb','__TO_SET__','vertrieb')
ON CONFLICT (email) DO NOTHING;
INSERT INTO users(email, name, pass_hash, role) VALUES
('viewer@example.com','Viewer','__TO_SET__','viewer')
ON CONFLICT (email) DO NOTHING;

