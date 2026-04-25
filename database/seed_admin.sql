-- Seed: Usuario administrador por defecto (admin / admin)
-- Ejecutar solo si se necesita insertar el usuario admin de forma independiente.
INSERT INTO usuarios (dni_nie, nombre, apellidos, email, telefono, role, password_hash)
VALUES (
    'admin',
    'Admin',
    'Sistema',
    'admin@example.com',
    '',
    'admin',
    crypt('admin', gen_salt('bf', 10))
)
ON CONFLICT (dni_nie) DO NOTHING;
