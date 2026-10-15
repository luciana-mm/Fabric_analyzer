# Guia de Captura e Anotação de Dataset — YOLO Defect Detector

Este documento descreve o fluxo completo para capturar, anotar e organizar o dataset de defeitos de tecido para o modelo YOLO.

---

## 📋 Lista Oficial de Classes

As classes do projeto são definidas estritamente em `camera-proxy/detector.py` (`DEFECT_CLASSES`). **Não altere a ordem nem os nomes** para evitar dessincronizar com anotações existentes.

| ID | Nome da Classe | Descrição |
|---|---|---|
| `0` | `furo` | Buracos, rasgos ou perfurações no tecido |
| `1` | `mancha` | Manchas de sujeira, óleo ou pigmentação anormal |
| `2` | `fio_puxado` | Fios desfocados, soltos ou puxados na trama |
| `3` | `tonalidade` | Variações de cor ou tonalidade fora do padrão |

---

## 🛠️ Ferramentas Recomendadas para Anotação

Você pode escolher entre duas ferramentas populares para anotação no formato YOLO:

### Opção A: `labelImg` (Leve e Rápida)
Ferramenta gráfica desktop ideal para anotações diretas em pastas locais.

1. **Instalação no venv**:
   ```bash
   source venv/bin/activate
   pip install labelImg
   ```

2. **Como Executar**:
   ```bash
   labelImg dataset/raw
   ```

3. **Configuração Obrigatória no labelImg**:
   - No menu lateral esquerdo, clique no botão do formato de saída até mudar para **YOLO** (por padrão pode estar em *PascalVOC*).
   - Defina o diretório de imagens ativas (*Open Dir*) como `dataset/raw`.
   - Defina o diretório de salvamento (*Change Save Dir*) como `dataset/raw`.
   - Crie/edite o arquivo `dataset/raw/classes.txt` contendo exatamente estas 4 linhas (uma por linha):
     ```text
     furo
     mancha
     fio_puxado
     tonalidade
     ```

---

### Opção B: `Label Studio` (Interface Web Completa)
Ferramenta web moderna com mais recursos de visualização.

1. **Instalação no venv**:
   ```bash
   source venv/bin/activate
   pip install label-studio
   ```

2. **Como Executar**:
   ```bash
   label-studio start
   ```

3. **Configuração**:
   - Crie um novo projeto no browser.
   - Importe os arquivos de imagem de `dataset/raw`.
   - Em *Labeling Setup*, escolha **Object Detection with Bounding Boxes**.
   - Adicione os nomes das classes na mesma ordem: `furo`, `mancha`, `fio_puxado`, `tonalidade`.
   - Ao finalizar a anotação, clique em **Export** e selecione o formato **YOLO**.
   - Descompacte os arquivos descarregados (`.jpg` + `.txt`) de volta na pasta `dataset/raw/`.

---

## 🔄 Fluxo de Trabalho Completo (Passo a Passo)

### Passo 1: Capturar Frames da Câmera
Certifique-se de que o serviço de proxy da câmera está em execução (`http://localhost:8090/snapshot.jpg`).

Execute o script de captura em outro terminal:
```bash
venv/bin/python camera-proxy/capture_snapshots.py --interval 2.0 --max-count 100 --output dataset/raw
```
*Parâmetros úteis*:
- `--interval 2.0`: Intervalo de 2 segundos entre cada foto.
- `--max-count 100`: Captura até 100 fotos e encerra.
- `--prefix frame`: Prefixo dos arquivos gerados.

### Passo 2: Anotar os Defectos Manualmente
Abra a ferramenta de anotação (ex: `labelImg`) apontando para `dataset/raw/`.
Desenhe os retângulos em volta dos defeitos reais e atribua as etiquetas corretas (`furo`, `mancha`, `fio_puxado`, `tonalidade`).

Após a anotação, cada imagem `frame_XXXX.jpg` terá um arquivo equivalente `frame_XXXX.txt` contendo as coordenadas YOLO no mesmo diretório (`dataset/raw/`).

### Passo 3: Dividir o Dataset (Treino / Validação)
Execute o script `split_dataset.py` para separar automaticamente o dataset anotado:
```bash
venv/bin/python dataset/split_dataset.py --source dataset/raw --ratio 0.8 --seed 42
```
Este comando move automaticamente:
- 80% dos pares (imagem + txt) para `dataset/images/train` e `dataset/labels/train`
- 20% dos pares (imagem + txt) para `dataset/images/val` e `dataset/labels/val`

*(Se desejar manter uma cópia na pasta raw sem mover, adicione a flag `--copy`)*.

### Passo 4: Conferir o arquivo `data.yaml`
Confira se o arquivo `dataset/data.yaml` está criado e atualizado. Caso queira regenerá-lo a qualquer momento a partir de `camera-proxy/detector.py`, execute:
```bash
venv/bin/python dataset/generate_data_yaml.py
```

---

## 📌 Próximos Passos
Após concluir a captura e anotação manual e rodar o `split_dataset.py`, notifique o assistente para darmos início à **Fase 4 (Augmentation Copy-Paste Sintético)** ou **Fase 5 (Treinamento)**.
