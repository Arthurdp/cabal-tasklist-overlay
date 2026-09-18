# Cabal Tasklist Overlay

Task list / contador de DGs para rush no **Cabal Online BR**, feito para uso em
stream (OBS) ou como janela flutuante em cima do jogo.

Made by: **zPenDragonTV**

---

## Funcionalidades

- Contador de repetições (**Dungeon +/-**) e de drops (**Drop +/-**) por task,
  com **atalhos globais** configuráveis (funcionam mesmo com o jogo em foco).
- Timer total do rush e tempo individual da task ativa.
- Meta por task: ao atingir a meta a task é concluída e a próxima vira ativa.
- Adicionar / excluir / renomear / reordenar (arrastar) tasks.
- **6 temas** de cores e controle de opacidade.
- **Tamanho do aplicativo** ajustável (50% a 200%).
- **Sempre no topo (Always on Top)** para quem joga em uma tela só.
- **Painel de configurações à esquerda ou à direita** do overlay.
- Lembra a posição da janela, as tasks e todas as configurações entre sessões.
- 100% offline (fontes embutidas, sem dependências de rede).

## Como usar

### Executável (Windows)

1. Baixe o `.exe` portátil na aba **Releases** (ou em **Actions → artifact**).
2. Execute. Não precisa instalar.
3. Clique em **⚙️ Configurações** para abrir o painel.
4. Arraste a janela pelo fundo do overlay para posicioná-la.

### OBS (Browser Source)

```bash
npm install
npm run start:web
```

Adicione uma fonte **Navegador** no OBS apontando para `http://localhost:3000`.

### Desenvolvimento

```bash
npm install
npm start          # abre o app Electron
npm run check      # valida sintaxe dos arquivos JS
npm run build      # gera dist/CabalTasklistOverlay-<versão>-portable.exe (Windows)
```

## Estrutura

```
electron-main.js   processo principal (janela, atalhos globais, IPC)
preload.js         ponte segura renderer <-> main
public/            interface (HTML/CSS/JS + fontes locais + tasks.json)
server.js          servidor estático mínimo para o modo OBS
build-icon.js      gera build/icon.ico
```

## Licença

MIT

## Gerar o .exe automaticamente (GitHub Actions)

O arquivo `ci/build-windows.yml` é um workflow pronto. Para ativar, copie-o para
`.github/workflows/build-windows.yml` no repositório (pelo site do GitHub ou
localmente) e faça push. A cada push o `.exe` aparece em **Actions → artifact**;
ao criar uma tag `v1.1.0`, uma **Release** é publicada com o executável.
