# Spool - ChatGPT Exporter

Userscript para exportar conversaciones de ChatGPT.

## Instalación

1. Instalar [TamperMonkey](https://tampermonkey.net)
2. Crear nuevo script → pegar contenido de `spool.user.js`

## Uso

1. Ir a chatgpt.com
2. Click botón 📦 (abajo derecha)
3. Seleccionar conversaciones
4. Exportar

## Features

- Selección individual de conversaciones
- Preview antes de exportar
- Filtro por fecha (semana/mes/año)
- Búsqueda por título
- Exporta JSON + Markdown + ZIP

## Formato de salida

```
chatgpt-export.zip
├── json/
├── markdown/
└── files/
```

## License

MIT