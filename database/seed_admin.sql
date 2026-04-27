-- Seed: Usuario administrador por defecto (admin / admin)
-- Ejecutar solo si se necesita insertar el usuario admin de forma independiente.
WITH ins AS (
    INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, password_hash)
    VALUES (
        'admin',
        'Admin',
        'Sistema',
        'admin@example.com',
        '',
        crypt('admin', gen_salt('bf', 10))
    )
    ON CONFLICT (dni_nie) DO NOTHING
    RETURNING id
)
INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT u.id, r.id
  FROM usuarios u
  JOIN roles r ON r.nombre = 'admin'
 WHERE u.dni_nie = 'admin'
ON CONFLICT (usuario_id, rol_id) DO NOTHING;
