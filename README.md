# TecnoFit Admin - Panel de Administración CRM

Panel de administración completo para TecnoFit con gestión de leads, contenido y analytics.

## 🎯 Características Principales

### Dashboard
- ✅ **Estadísticas en tiempo real** de leads
- ✅ **Gráficos interactivos** con Recharts
- ✅ **Métricas clave** del negocio
- ✅ **Leads recientes** con vista previa
- ✅ **Distribución por estados** visual

### Gestión de Leads
- ✅ **Lista completa** de leads con filtros
- ✅ **Estados personalizables**: Nuevo, Contactado, Convertido, Perdido
- ✅ **Búsqueda avanzada** por nombre, email, teléfono
- ✅ **Exportación CSV** de todos los datos
- ✅ **Vista detallada** de cada lead
- ✅ **Actualización de estados** en tiempo real

### Gestión de Contenido
- ✅ **Homepage content** editable
- ✅ **Pricing information** dinámica
- ✅ **SEO optimization** integrada
- ✅ **Preview en tiempo real**
- ✅ **Versionado** de contenido

### Autenticación
- ✅ **Login seguro** con JWT
- ✅ **Sesiones persistentes**
- ✅ **Logout automático** por seguridad
- ✅ **Validación de tokens**

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Ejecutar en desarrollo
npm run dev

# Build para producción
npm run build
```

## 🔧 Configuración

### Variables de Entorno
```env
VITE_API_URL=http://localhost:1337/api
```

### Configuración de Strapi
Asegúrate de que el backend Strapi esté ejecutándose en el puerto 1337.

## 📊 Dashboard Analytics

### Métricas Principales
- **Total de Leads**: Contador general
- **Leads Nuevos**: Leads sin contactar
- **Leads Contactados**: En proceso de seguimiento
- **Leads Convertidos**: Clientes adquiridos

### Gráficos Disponibles
- **Distribución por Estados**: Bar chart
- **Tendencia Temporal**: Line chart (próximamente)
- **Conversión por Objetivo**: Pie chart (próximamente)

## 👥 Gestión de Leads

### Estados de Lead
1. **Nuevo**: Lead recién recibido
2. **Contactado**: En proceso de seguimiento
3. **Convertido**: Cliente adquirido
4. **Perdido**: Lead no convertido

### Funcionalidades
- **Filtrado**: Por estado, fecha, objetivo
- **Búsqueda**: Nombre, email, teléfono
- **Ordenamiento**: Por fecha, estado, nombre
- **Exportación**: CSV con todos los datos
- **Bulk Actions**: Acciones masivas (próximamente)

### Campos de Lead
- **Información Personal**: Nombre, apellido
- **Contacto**: Email, teléfono
- **Objetivo**: 8 opciones en español
- **Estado**: 4 estados disponibles
- **Fecha**: Timestamp de envío
- **Notas**: Campo libre para observaciones

## 📝 Gestión de Contenido

### Homepage Content
- **Hero Section**: Título, subtítulo, descripción
- **About Section**: Título y contenido
- **Services Section**: Título y descripción
- **SEO**: Meta título, descripción, keywords

### Pricing Content
- **Información General**: Título y subtítulo
- **Planes**: Nombre, precio, descripción, características
- **Features**: Lista de beneficios por plan

## 🔐 Seguridad

### Autenticación
- **JWT Tokens**: Autenticación segura
- **Sesiones**: Persistencia en localStorage
- **Validación**: Verificación de tokens
- **Logout**: Limpieza de sesión

### Autorización
- **Rutas Protegidas**: Acceso solo con autenticación
- **API Calls**: Headers de autorización automáticos
- **Error Handling**: Manejo de errores 401/403

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Adaptaciones
- **Sidebar**: Colapsable en mobile
- **Tables**: Scroll horizontal en mobile
- **Forms**: Optimizados para touch
- **Charts**: Responsivos automáticamente

## 🎨 UI/UX

### Componentes
- **Cards**: Información agrupada
- **Tables**: Datos tabulares
- **Forms**: Inputs y validaciones
- **Modals**: Ventanas emergentes
- **Charts**: Visualización de datos

### Colores
- **Primario**: #0284c7 (Azul)
- **Estados**: Verde (éxito), Rojo (error), Amarillo (advertencia)
- **Neutros**: Escala de grises

### Iconos
- **Heroicons**: Iconos consistentes
- **Estados**: Visual feedback
- **Acciones**: Intuitivas

## 📊 Exportación de Datos

### Formato CSV
```csv
Nombre,Apellido,Email,Teléfono,Objetivo,Estado,Fecha
Juan,Pérez,juan@email.com,+54 11 1234-5678,perdida-peso,nuevo,2024-01-15
```

### Campos Incluidos
- Información personal completa
- Datos de contacto
- Objetivo de entrenamiento
- Estado actual
- Fecha de envío
- Notas adicionales

## 🔄 Sincronización

### Tiempo Real
- **Auto-refresh**: Datos actualizados automáticamente
- **WebSocket**: Conexión en tiempo real (próximamente)
- **Polling**: Verificación periódica de cambios

### Cache
- **Local Storage**: Datos persistentes
- **Session Storage**: Datos temporales
- **Memory Cache**: Optimización de performance

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conectar repositorio
2. Configurar variables de entorno
3. Deploy automático

### Netlify
1. Build command: `npm run build`
2. Publish directory: `dist`
3. Configurar variables de entorno

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 🧪 Testing

### Tests Unitarios
```bash
npm run test
```

### Tests de Integración
```bash
npm run test:integration
```

### Tests E2E
```bash
npm run test:e2e
```

## 📈 Performance

### Optimizaciones
- **Code Splitting**: Carga bajo demanda
- **Lazy Loading**: Componentes diferidos
- **Memoization**: Re-renders optimizados
- **Bundle Size**: Minimizado automáticamente

### Métricas
- **First Paint**: < 1.5s
- **Interactive**: < 2.5s
- **Bundle Size**: < 500KB
- **Lighthouse Score**: 95+

## 🔧 Desarrollo

### Estructura de Archivos
```
src/
├── components/          # Componentes reutilizables
│   ├── Dashboard.jsx   # Dashboard principal
│   ├── Leads.jsx       # Gestión de leads
│   ├── ContentManagement.jsx # Gestión de contenido
│   └── ...
├── services/           # API calls
│   ├── authService.js  # Autenticación
│   └── leadsService.js # Gestión de leads
├── App.jsx             # Componente principal
└── main.jsx           # Entry point
```

### Convenciones
- **Naming**: PascalCase para componentes
- **Props**: camelCase
- **CSS Classes**: kebab-case
- **Files**: PascalCase para componentes

## 📞 Soporte

Para consultas técnicas o soporte:
- **Email**: info@tecnofit.com.ar
- **Teléfono**: +54 11 1234-5678
- **Ubicación**: Costa Rica 3060, Palermo, Buenos Aires

## 📄 Licencia

© 2024 TecnoFit. Todos los derechos reservados.