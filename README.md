# Declaración de la Renta 2025 – IRPF

Formulario de la Declaración de la Renta construido con **React + Vite**.

## Características

- Formulario completo de IRPF con todos los apartados (datos personales, rendimientos, deducciones, situación familiar, pagos fraccionados).
- Cálculo estimado en tiempo real (base imponible, cuota íntegra, cuota líquida y resultado).
- Al pulsar **Enviar declaración** se hace un `POST` con todos los datos al endpoint:
  ```
  POST https://api.aeat.gob.es/v1/irpf/declaraciones
  Content-Type: application/json
  ```
- Notificación visual (toast) con el resultado del envío.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
npm run preview
```
