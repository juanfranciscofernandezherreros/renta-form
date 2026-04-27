-- Seed: Usuario administrador por defecto (admin / admin)
-- Ejecutar solo si se necesita insertar el usuario admin de forma independiente.
-- El administrador se identifica por `username`; no tiene DNI/NIE.
WITH ins AS (
    INSERT INTO usuarios (username, dni_nie, dni_nie_hash, nombre, apellidos, email, telefono, password_hash)
    VALUES (
        'admin',
        NULL,
        NULL,
        'Admin',
        'Sistema',
        'admin@example.com',
        '',
        crypt('admin', gen_salt('bf', 10))
    )
    ON CONFLICT (username) WHERE username IS NOT NULL DO NOTHING
    RETURNING id
)
INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT u.id, r.id
  FROM usuarios u
  JOIN roles r ON r.nombre = 'admin'
 WHERE u.username = 'admin'
ON CONFLICT (usuario_id, rol_id) DO NOTHING;

