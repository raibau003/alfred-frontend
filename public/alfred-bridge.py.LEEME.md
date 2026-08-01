# El bridge ya no se sirve desde acá

Este repo servía `public/alfred-bridge.py`, y `alfred-railway/pc-bridge/` tenía
otra copia del mismo archivo. Dos copias, dos repos, nada que las sincronizara.

Se separaron: el 2026-07-28 la del front —que es la que se instala en la Mac—
estaba en la versión del 19 de julio, con 243 líneas y 8 de las 18 acciones, sin
los alias `open_url`/`type`. O sea que el arreglo del carro del súper que la
convención #13 de Alfred da por resuelto nunca llegó a la máquina, y llevaba dos
semanas así sin que nada lo notara.

**Ahora el cliente lo sirve el router**, desde la misma imagen en la que corre el
servidor con el que habla:

    GET https://alfred-router-prod-production.up.railway.app/bridge/script

La fuente es `agents/router/alfred-bridge.py` en el repo `alfred-railway`. El
bridge manda su `BRIDGE_VERSION` al registrarse y el router avisa si está viejo;
además, no se le encolan acciones que su versión no implementa.
