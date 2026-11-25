# На новом компьютере (важнее путей из HANDOFF-character.md)
Нужны: Git, JDK 21, Node 22+, Python 3 с Pillow и numpy, Google Chrome.
Все инструменты лежат в этой папке, пути относительные. `_character-wip` из HANDOFF = эта папка.

1. Портал для API на порту 8094, из корня репозитория: `./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8094`
2. `node _handoff/dev.mjs` (страница на 8196, CSP включён).
3. `bash _handoff/run.sh m6.py`, затем смотреть `_handoff/all.png`.
4. Путь к Chrome задан в `cs.mjs`.

`prep.py` нужен только для пересборки human.bin; исходники MakeHuman не переносились, готовый human.bin уже в static/js.
Перед переносом в `front` папку `_handoff` удалить.
Правило: коммитит и пушит пользователь, Claude даёт команды.
