# Mu La Ronda

Lista de servidores que el cliente muestra al iniciar. deploy.sh la genera en
dist/serverlist.md reemplazando ${DOMAIN}. Formato: ver serverlist.md en la raiz.

El cargador (src/ui/pages/rondaLoader) entra directo al mundo llamado
"Mu La Ronda": si se cambia el nombre aca, cambiarlo tambien alla (WORLD_NAME).
El grupo "MU" y el canal "Mu La Ronda" son lo que se ve en el selector de
servidores (ServerID 0 de OpenMU).

[S6EP3:Mu La Ronda:Season 6 Episode 3:es:](${DOMAIN})
- 0: MU
  - 0: Mu La Ronda
