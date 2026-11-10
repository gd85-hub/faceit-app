<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Передача работы

В конце каждой рабочей сессии обнови `HANDOFF.md`:

- Раздел «Состояние» — перепиши целиком: где сейчас проект,
  что работает, что сломано, какие решения приняты и почему.
- Раздел «Журнал» — допиши одну строку: дата, что сделано,
  диапазон коммитов. Старые строки не трогай.
- Раздел «Дальше» — перепиши: следующие шаги в порядке
  зависимостей, открытые вопросы к человеку.

Детали изменений не дублируй — для них есть `git log`.
Пиши так, чтобы агент, открывший репозиторий впервые и не
видевший переписки, мог продолжить работу.
