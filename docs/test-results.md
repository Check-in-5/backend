# Resultado de pruebas

Ejecución local: 29 de septiembre de 2026, Node.js v22.19.0, Windows.
Comando: npm.cmd test.
Resultado final: 22 pruebas aprobadas, 0 fallidas, 0 omitidas.

Se verificaron registro y validación HTTP con SQLite real; consulta repetida sin consumo; QR opcional coherente; duplicados sin sobrescritura; ocho registros simultáneos con una sola creación; ticket desconocido y evento incorrecto sin exposición de nombre; datos incompletos, tipos, límites y campos adicionales; JSON inválido; límite del cuerpo; error de BD sin detalles internos; persistencia al cerrar y reabrir SQLite; parámetros SQL; Swagger y retiro de la ruta anterior.

No se probaron integraciones reales con Entradas ni autenticación. La colección Postman fue actualizada para ejecución manual, pero no ejecutada en Postman. No se certificó el SLA mediante prueba de carga.