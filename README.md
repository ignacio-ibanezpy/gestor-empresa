# Panel Operativo — Gestión de Trabajos y Notas

Aplicación web progresiva (PWA) desarrollada para organizar la operativa diaria, seguimiento de trabajos pendientes y registro de notas rápidas con sincronización en tiempo real.

**Demo en vivo:** [gestor-empresa.pages.dev](https://gestor-empresa.pages.dev)

## Funcionalidades principales
- **Gestión diaria y arrastre automático:** Reprogramación automática de trabajos incompletos hacia la fecha actual con indicador de días de retraso.
- **Estados operativos:** Control de flujo por estado (*Pendiente*, *En curso*, *Faltante*, *Completado*).
- **Bloc de notas integrado:** Espacio de anotaciones rápidas sincronizado por usuario.
- **Multiplataforma (PWA):** Instalable en escritorio y dispositivos móviles desde el navegador.

## Stack tecnológico
- **Frontend:** React + Vite
- **Backend & Autenticación:** Supabase (PostgreSQL + Row Level Security)
- **Despliegue continuo (CI/CD):** GitHub + Cloudflare Pages
