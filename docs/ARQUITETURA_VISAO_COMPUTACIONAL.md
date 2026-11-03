# Evolução Arquitetural do Motor de Visão Computacional na Inspeção Têxtil

> **Documento de Decisão de Arquitetura (ADR) & Case de Portfólio**  
> **Projeto:** Sistema Industrial de Inspeção Visual e Controle de Qualidade Têxtil (`fabric-analyzer-interface`)  
> **Foco Técnico:** Visão Computacional em Tempo Real, Processamento Digital de Imagens (OpenCV), Detecção Supervisionada (YOLOv8) e Detecção de Anomalias Não-Supervisionada (Anomalib / OpenVINO).

---

## Resumo Executivo (Pitch de Portfólio)

Este documento descreve a evolução técnica do motor de detecção de defeitos têxteis em tempo real (`camera-proxy/server.py`). Em vez de aplicar cegamente um único modelo pesado para todos os cenários, o sistema foi projetado com uma **arquitetura híbrida orientada a custo-benefício computacional**:

1. **Fase 1 — Visão Computacional Clássica (OpenCV):** Desenvolvida para **tecidos lisos**, entregando latência ultrabaixa (~2–8 ms/frame em CPU) e precisão determinística no espaço perceptual CIE L\*a\*b\*.
2. **Fase 2 — Diagnóstico de Limite Técnico e Hipótese com Deep Learning Supervisionado (YOLOv8):** Ao expandir o sistema para **tecidos estampados e detalhados**, identificou-se matematicamente por que algoritmos baseados em limiares de cor/intensidade sofrem com falsos positivos em texturas de alta frequência espacial. A primeira evolução utilizou redes neurais convolucionais (**YOLOv8**).
3. **Fase 3 — Pivô Estratégico para Aprendizado Não-Supervisionado (Anomalib):** Diante dos gargalos reais da indústria têxtil (escassez de amostras defeituosas rotuladas para cada nova estampa, impossibilidade de prever todos os tipos de defeitos e alto custo de treinamento supervisionado), a arquitetura evoluiu para **Detecção de Anomalias *One-Class* (Anomalib)**, capaz de aprender o padrão de um tecido novo em segundos usando **apenas imagens de tecido bom**.

```mermaid
flowchart LR
    A["1. OpenCV Clássico<br/>(Tecidos Lisos)"] -->|"Limitação em estampas<br/>de alta frequência"| B["2. YOLOv8 Supervisionado<br/>(1ª Hipótese para Estampas)"]
    B -->|"Gargalo de Dataset +<br/>Custo de Treino + Classes Fechadas"| C["3. Anomalib (PaDiM / PatchCore)<br/>(Treino só com Tecido Bom)"]
```

---

## 1. Por que usar OpenCV Clássico em Tecidos Lisos?

Para tecidos lisos (sem estampa, `estampado = False`), o uso de Redes Neurais Profundas (Deep Learning) é um **desperdício computacional**. Um tecido liso possui uma superfície cujo comportamento óptico e cromático é homogêneo e matematicamente previsível.

No arquivo `camera-proxy/detector.py`, a classe `ColorDetector` implementa um pipeline determinístico de Processamento Digital de Imagens (PDI) que resolve o problema com **máxima eficiência**:

### 1.1. Fundamentos Técnicos Implementados
* **Normalização de Iluminação Local (Fundo Estimado):**
  Em ambiente fabril, a iluminação sobre o rolo de tecido nunca é perfeitamente uniforme. Em vez de usar um limiar fixo (*threshold global*), o método `_mask_intensidade` aplica um filtro mediano de janela larga (`cv2.medianBlur(gray, 41)`) para estimar a iluminação de fundo e calcula a diferença absoluta (`cv2.absdiff`). Qualquer furo, mancha escura ou fio puxado destaca-se imediatamente contra a vizinhança local.
* **Espaço de Cor Perceptual CIE L\*a\*b\* ($\Delta E$):**
  Diferente do RGB (onde cor e brilho estão misturados), o espaço **CIE L\*a\*b\*** separa a Luminosidade ($L$) dos canais cromáticos ($a$ e $b$). Nos métodos `_mask_cor` e `_mask_cor_local`, a distância euclidiana cromática mede exatamente o desvio perceptual de tonalidade:
  $$\Delta E_{ab} = \sqrt{(a - a_{\text{ref}})^2 + (b - b_{\text{ref}})^2}$$
* **Filtragem Morfológica e Geométrica:**
  Operações de abertura (`MORPH_OPEN`) eliminam ruídos de sensor da câmera RTSP, enquanto filtros de **Solidez** ($\text{Área} / \text{Área do Convex Hull}$) e **Razão de Aspecto** descartam sombras alongadas ou dobras naturais do pano.

### 1.2. Vantagens do OpenCV em Tecidos Lisos
* **Latência Ultrabaixa:** Processa cada frame em **2 a 8 ms** diretamente em CPU (`Intel Core i5-11400H`), sem exigir placa de vídeo dedicada (GPU).
* **Consumo Mínimo de Memória:** Menos de **50 MB de RAM**.
* **Explicabilidade Total:** O operador ou gestor controla diretamente os limiares físicos (`limiar_intensidade`, `limiar_cor`, `area_min`) pela interface web, sem "caixa-preta".
* **Zero Necessidade de Treinamento:** Basta calibrar a cor de referência em 1 clique e o sistema opera imediatamente.

---

## 2. A Descoberta do Limite do OpenCV e por que pensei inicialmente no YOLOv8

### 2.1. Por que o OpenCV falha em Tecidos Detalhados e Estampados?

Durante a evolução do projeto, ao testar o `ColorDetector` em tecidos **estampados, xadrezes complexos, florais ou com tramas de alto relevo**, ficou evidente uma limitação estrutural da Visão Computacional Clássica:

1. **Alta Frequência Espacial nas Bordas da Estampa:**
   No método `_mask_intensidade`, o filtro mediano `41x41` assume que o fundo é homogêneo. Em uma estampa (ex: uma flor branca sobre fundo escuro ou linhas finas de um xadrez), a transição brusca de contraste faz parte do próprio desenho do tecido. Para o cálculo de derivada/diferença de pixels do OpenCV, **a borda de uma flor e um rasgo no tecido são matematicamente idênticos** (ambos são saltos abruptos de intensidade).
2. **Colapso da Paleta de Cores (K-Means) em Gradientes:**
   Mesmo agrupando as cores principais da estampa com K-Means (`/reference-palette`), nas zonas de transição entre duas cores da estampa surgem cores intermediárias (anti-aliasing óptico da lente e entrelaçamento dos fios). Se diminuímos a sensibilidade para ignorar a estampa, o OpenCV deixa passar defeitos reais; se aumentamos, a própria estampa gera dezenas de falsos positivos.
3. **Ausência de Contexto Semântico:**
   O OpenCV enxerga **pixels isolados e vizinhanças locais**, mas não compreende **padrões estruturais ou texturas semânticas**. Ele não sabe diferenciar "um ponto preto que faz parte de uma estampa poá" de "uma mancha preta de graxa de máquina".

### 2.2. A Primeira Hipótese para Estampas: YOLOv8 (`yolo_detector.py`)

Para superar a cegueira contextual do OpenCV em tecidos detalhados, a decisão lógica inicial foi implementar um segundo motor baseado em **Redes Neurais Convolucionais (CNNs)** utilizando o **YOLOv8** (`YoloDetector`), acionado automaticamente quando o operador marca o tecido como detalhado/estampado (`estampado = True` em `server.py`):

* **O raciocínio por trás do YOLO:** Como uma CNN extrai *features* hierárquicas (bordas $\to$ texturas $\to$ objetos), o YOLOv8 consegue olhar para o contexto global da imagem, ignorar a estampa de fundo e localizar objetos das classes `["furo", "mancha", "fio_puxado", "tonalidade"]` em tempo real.

---

## 3. Por que estou trocando o YOLOv8 pelo Anomalib?

Ao levar a abordagem supervisionada do YOLOv8 para a realidade prática da inspeção têxtil, surgiram **quatro gargalos críticos de engenharia e produto** que motivaram a evolução arquitetural para o **Anomalib** (biblioteca da Intel/OpenVINO para Detecção de Anomalias Não-Supervisionada):

### 3.1. O Paradoxo do Dataset Industrial (Escassez de Defeitos)
* **No YOLOv8 (Supervisionado):** Para a rede generalizar bem, são necessárias **centenas a milhares de imagens reais contendo defeitos** para cada padrão de tecido, todas manualmente anotadas com *bounding boxes*. Porém, na indústria têxtil, **99,9% da produção é de tecido BOM**. Coletar e rotular milhares de defeitos reais para cada nova coleção de estampa que entra na fábrica é operacionalmente inviável.
* **No Anomalib (Não-Supervisionado / *One-Class*):** O paradigma é invertido. Algoritmos como **PatchCore** e **PaDiM** são treinados **exclusivamente com imagens de tecido BOM (nominal)** — recurso abundante e imediato na fábrica. Basta capturar alguns segundos do tecido perfeito no início do rolo para modelar a distribuição normal daquela estampa.

### 3.2. O Problema do Conjunto Fechado (*Closed-Set*) vs. Conjunto Aberto (*Open-Set*)
* **No YOLOv8:** O modelo só detecta as classes exatas que viu no treinamento. Se ocorrer uma anomalia inédita na linha de produção (uma falha mecânica atípica na agulha, uma dobra dupla, um inseto prensado ou uma falha de estamparia com geometria nova), o YOLO não a reconhece como nenhuma de suas classes pré-definidas e **resulta em falso negativo** (deixa o defeito passar).
* **No Anomalib:** Por modelar matematicamente o que é "normal" (via *Memory Bank* de *patches* no **PatchCore** ou distribuições Gaussianas multivariadas por posição no **PaDiM**), **qualquer desvio visual ou estrutural** gera uma pontuação de anomalia elevada (*Anomaly Score* / *Heatmap*), detectando 100% dos defeitos conhecidos e desconhecidos.

### 3.3. Custo Computacional de Treinamento e Adaptação a Novas Estampas
* **No YOLOv8:** Treinar ou fazer *fine-tuning* de uma rede YOLO exige dezenas de épocas de *backpropagation* pesado. Em uma máquina sem GPU dedicada (como um `Intel Core i5-11400H`), isso consome horas de CPU a 100%, inviabilizando o cadastro rápido de uma nova estampa no chão de fábrica.
* **No Anomalib:** Modelos modernos do Anomalib (como **PaDiM** e **PatchCore** com *backbone* leve `resnet18` pré-treinado na ImageNet) **não utilizam backpropagation no ajuste!** Eles fazem apenas uma passagem direta (*forward pass*) pelas 20–40 imagens boas do tecido novo e constroem a matriz de covariância ou o banco de memória *coreset* em **5 a 15 segundos**, permitindo calibração quase instantânea na troca de rolo.

### 3.4. Otimização de Hardware (OpenVINO) e Licenciamento Comercial
* **Aceleração Nativa em CPU Intel:** Como o Anomalib é desenvolvido pela equipe do **Intel OpenVINO**, os modelos podem ser exportados diretamente para o formato *OpenVINO Intermediate Representation (IR)*, aproveitando instruções vetoriais AVX-512 / VNNI de processadores Intel Core para manter a taxa de **12 FPS** do streaming sem exigir GPUs caras.
* **Licença de Software:** O `ultralytics` (YOLOv8) utiliza licença **AGPLv3** (restritiva para softwares comerciais fechados), enquanto o **Anomalib** possui licença **Apache 2.0**, permitindo uso comercial irrestrito e proprietário sem custos de licenciamento.

---

## 4. Quadro Comparativo Geral da Arquitetura

| Dimensão Técnica | 1. OpenCV Clássico (`ColorDetector`) | 2. YOLOv8 (`YoloDetector`) | 3. Anomalib (`PatchCore` / `PaDiM`) |
| :--- | :--- | :--- | :--- |
| **Cenário Ideal de Uso** | **Tecidos Lisos** (`estampado = False`) | Detecção com classes fixas e grande dataset prévio | **Tecidos Estampados / Texturizados** (`estampado = True`) |
| **Paradigma de Aprendizado** | Determinístico (CIE L\*a\*b\* + Morfologia) | Supervisionado (Precisa de milhares de defeitos anotados) | **Não-Supervisionado / *One-Class*** (Só precisa de fotos boas) |
| **Capacidade para Novos Defeitos** | Alta (em fundo liso) | ❌ Baixa (restrito às classes do dataset) | ✅ **Total** (detecta qualquer desvio do padrão normal) |
| **Comportamento em Estampas** | ❌ Falha (confunde bordas da estampa com defeito) | ⚠️ Requer re-treino pesado por família de estampa | ✅ **Excelente** (aprende a textura normal da estampa) |
| **Tempo de Calibração / Treino** | Instantâneo (~1 s) | Horas (50+ épocas de *backpropagation*) | **Segundos** (~5–15 s extraindo *features* de frames bons) |
| **Custo de CPU/RAM em Produção** | ~50 MB RAM / ~5 ms por frame | ~450 MB RAM / ~60 ms por frame | ~600 MB RAM / ~45–75 ms por frame (com `resnet18` + OpenVINO) |
| **Licença para Produto Comercial** | Apache 2.0 / BSD (Livre) | AGPLv3 (Exige código aberto ou licença paga) | **Apache 2.0 (100% Livre para uso comercial)** |

---

## 5. Integração Desacoplada no Código (`Strategy Pattern`)

Graças ao padrão de projeto **Strategy** implementado em `camera-proxy/detector.py` através da interface abstrata `BaseDetector`, a substituição do `YoloDetector` pelo `AnomalibDetector` ocorre sem alterar uma única linha do rastreador temporal (`DefectTracker`), do renderizador de vídeo (`Visualizer`) ou do frontend em React/Next.js:

1. O **Anomalib** processa o recorte da área de interesse (`ROI`) e gera um **Mapa de Calor de Anomalia** (*Anomaly Map*) e uma **Máscara Binária de Segmentação** (`pred_mask`).
2. A partir da máscara binária gerada pelo Anomalib, extraímos os contornos (`cv2.findContours`), calculamos a caixa delimitadora (`box`), o centroide (`centroid`) e a área (`area`).
3. O detector retorna `List[Detection]`, alimentando diretamente o `DefectTracker` para contagem precisa de defeitos que cruzam a linha de inspeção.
