# Guia de Integração - Sistema de Calibração de Luz e Captura de Cor Robusto

## 📋 Resumo da Implementação

O **fabric-analyzer-interface** agora possui um sistema de calibração de luz e análise de cor **robusto e científico**, baseado na implementação do projeto **meta-classificador-tecidos**. O sistema utiliza **padrão D65** (iluminante CIE oficial) e implementa a fórmula **CIEDE2000** para cálculo de diferenças de cor.

---

## 🎯 Componentes Implementados

### 1. **Utilidades de Conversão de Cor** (`src/utils/colorSpaceConversion.ts`)

Implementa conversão completa entre espaços de cor:

```typescript
// RGB (0-1) → LAB
const lab = rgbToLab(normalizedRgb);

// LAB → RGB
const rgb = labToRgb(lab);

// Delta E CIEDE2000 (mais preciso)
const deltaE = calculateDeltaE2000(referenceLab, sampleLab);

// Delta E CIE76 (mais rápido)
const deltaE76 = calculateDeltaE76(referenceLab, sampleLab);
```

**Características:**
- ✅ Matriz de conversão sRGB→XYZ (oficial CIE)
- ✅ Iluminante D65 codificado (x=95.047, y=100.0, z=108.883)
- ✅ Correção de gamma sRGB (2.4)
- ✅ Validação de valores LAB
- ✅ CIEDE2000 com 7 funções de peso (máxima precisão)

### 2. **Utilitários de Calibração** (`src/utils/calibrationUtils.ts`)

Implementa validação e processamento robusto de amostras:

```typescript
// Remove outliers (Método IQR)
const cleanSamples = removeColorOutliers(colorSamples);

// Calcula média ponderada robusta
const robustMean = calculateRobustColorMean(cleanSamples);

// Valida calibração com múltiplos critérios
const validation = validateLightCalibration(
  calibrationColor,
  samples,
  luminanceValues,
  stdDev
);
```

**Validações Implementadas:**
- 📊 Luminância (5%-98% do máximo)
- ⚖️ Equilíbrio RGB (diferença < 15%)
- 📈 Variação de luz (coef. variação < 8%)
- 🎯 Estabilidade (desvio padrão < 0.15)

### 3. **Hook de Calibração Robusta** (`src/hooks/useRobustColorCalibration.ts`)

Gerencia fluxo completo de calibração:

```typescript
const calibration = useRobustColorCalibration();

// Calibrar luz branca
const success = await calibration.startLightCalibration(
  async (i, total) => await captureRobustSample(),
  5,    // número de amostras
  200   // intervalo em ms
);

// Capturar e analisar cor
const { success, fabricColor, correctedColor, qualityMetrics } = 
  await calibration.startColorCapture(
    async (i, total) => await captureRobustSample()
  );
```

**Processos:**
1. Captura múltiplas amostras (5x padrão)
2. Remove outliers com IQR
3. Calcula média ponderada robusta
4. Valida qualidade com scoring (0-100%)
5. Aplica correção de cor baseada na calibração

### 4. **Proxy de Câmera Robusto** (atualizado `camera-proxy/server.py`)

Novo endpoint para captura robusta:

```python
POST /capture-robust-sample?sample_count=5&interval_ms=200

Response:
{
  "success": true,
  "rgb": {"r": 250, "g": 248, "b": 245},
  "hex": "#faf8f5",
  "samples_captured": 5,
  "samples_used": 5,
  "average_luminance": 0.98,
  "stability_score": 0.92
}
```

**Implementa no servidor:**
- Remove outliers com IQR
- Média ponderada robusta
- Métricas de qualidade
- Tolerância a falhas de captura

### 5. **Componente ColorCapture Atualizado** (`src/components/ColorCapture.tsx`)

Interface aprimorada com 3 etapas:

```
┌─────────────────────────────────────┐
│ 1. CALIBRAR LUZ (D65)               │ ← Múltiplas amostras
│    Status: Calibrada ✓              │   + Validação
│    Qualidade: 95%                   │
├─────────────────────────────────────┤
│ 2. CAPTURAR COR                     │ ← Requer etapa 1
│    Qualidade: 88%                   │   + Correção aplicada
├─────────────────────────────────────┤
│ 3. SALVAR                           │ ← Salva dados calibrados
│    Cor: #faf8f5                     │
└─────────────────────────────────────┘
```

### 6. **Padrões Colorimétricos** (`src/utils/colorimetricStandards.ts`)

Definições de padrões CIE:

```typescript
// D65 Illuminant (6504K)
CIE_D65_ILLUMINANT = { x: 95.047, y: 100.0, z: 108.883 }

// Tolerâncias Delta E para têxteis
TEXTILE_COLOR_TOLERANCE = {
  strict: 0.5,  // Grade A (Premium)
  high: 1.0,    // Grade B (Fashion)
  medium: 2.0,  // Grade C (Commercial)
  loose: 3.0    // Grade D (Casual)
}

// Qualidade de calibração
CALIBRATION_QUALITY = {
  excellent: >= 80%,
  good: >= 60%,
  acceptable: >= 40%,
  poor: < 40%
}
```

---

## 🚀 Como Usar

### Fluxo de Calibração

#### 1. Inicializar o Sistema

```typescript
import { useRobustColorCalibration } from '@/hooks/useRobustColorCalibration';
import { useCameraRobustCapture } from '@/hooks/useCameraRobustCapture';

function MyComponent() {
  const calibration = useRobustColorCalibration();
  const camera = useCameraRobustCapture();
  
  // ...
}
```

#### 2. Calibrar Luz Branca

```typescript
async function handleLightCalibration() {
  // Preparar callback de captura
  const captureCallback = async (index, total) => {
    console.log(`Capturando amostra ${index + 1}/${total}`);
    return await camera.captureRobustSample(1, 100);
  };

  // Executar calibração (5 amostras, 200ms de intervalo)
  const success = await calibration.startLightCalibration(
    captureCallback,
    5,
    200
  );

  if (success) {
    console.log('Qualidade:', calibration.qualityScore);
    console.log('Referência:', calibration.lightCalibrationData);
  }
}
```

#### 3. Capturar Cor de Tecido

```typescript
async function handleColorCapture() {
  const result = await calibration.startColorCapture(
    async (index, total) => {
      return await camera.captureRobustSample(1, 100);
    }
  );

  if (result.success) {
    console.log('Cor capturada:', result.fabricColor);
    console.log('Cor corrigida:', result.correctedColor);
    console.log('Qualidade:', result.qualityMetrics);
  }
}
```

#### 4. Comparar com Padrão

```typescript
import { rgbToLab, calculateDeltaE2000 } from '@/utils/colorSpaceConversion';
import { TEXTILE_COLOR_TOLERANCE } from '@/utils/colorimetricStandards';

function evaluateColor(fabricRgb, referenceRgb) {
  const fabricLab = rgbToLab(fabricRgb);
  const referenceLab = rgbToLab(referenceRgb);
  
  const deltaE = calculateDeltaE2000(referenceLab, fabricLab);
  const maxDeltaE = TEXTILE_COLOR_TOLERANCE.high.deltaE; // 1.0
  
  if (deltaE <= maxDeltaE) {
    return `✓ APROVADO (ΔE = ${deltaE.toFixed(2)})`;
  } else {
    return `✗ REPROVADO (ΔE = ${deltaE.toFixed(2)} > ${maxDeltaE})`;
  }
}
```

---

## 📊 Estrutura de Dados

### Light Calibration Data

```typescript
interface CalibratedColorData {
  referenceRgb8Bit: { r: number; g: number; b: number };    // 0-255
  referenceRgbNormalized: { r: number; g: number; b: number }; // 0-1
  referenceLabColor: { L: number; a: number; b: number };     // LAB space
  referenceHex: string;                                        // #RRGGBB
  luminance: number;                                           // 0-1
  qualityScore: number;                                        // 0-100
  timestamp: number;                                           // ms
}
```

### Color Quality Metrics

```typescript
interface ColorQualityMetrics {
  luminanceScore: number;   // 0-100
  stabilityScore: number;   // 0-100
  correctionScore: number;  // 0-100
  overallScore: number;     // 0-100
}
```

### Validation Result

```typescript
interface CalibrationValidationResult {
  isValid: boolean;
  qualityScore: number;     // 0-100
  issues: string[];
  metrics: {
    averageLuminance: number;
    standardDeviation: number;
    rgbBalance: number;
    lightVariation: number;
    samplesUsed: number;
    samplesTotal: number;
  };
}
```

---

## 🔬 Detalhes Técnicos

### Fórmula CIEDE2000

A implementação usa a fórmula **CIEDE2000** com 7 funções de peso:

```
ΔE = √(L'²/sL² + C'²/sC² + H'²/sH² + RT·(C'/sC)·(H'/sH))
```

Onde:
- **L', C', H'** = Diferenças em LAB corrigidas
- **sL, sC, sH** = Fatores de peso baseados em psicofísica
- **RT** = Termo de rotação para hue

Resultado:
- **0.0** = Cores idênticas
- **1.0** = Apenas levemente notável (treinado)
- **2.0** = Notável
- **3.0** = Óbvio
- **> 5.0** = Muito claro

### Remoção de Outliers (IQR)

```
1. Calcula distância de cada amostra à média
2. Calcula Q1 (25%), Q3 (75%)
3. Threshold = Q3 + 1.5 × IQR
4. Remove amostras acima do threshold
```

### Média Ponderada Robusta

```
Para cada amostra:
  weight = 1 / (1 + distance × 5)
  
weighted_mean = Σ(sample × weight) / Σ(weight)
```

O fator 5 aumenta o peso de amostras próximas à média.

---

## ✅ Checklist de Implementação

- ✅ Conversão RGB ↔ XYZ (D65)
- ✅ Conversão XYZ ↔ LAB
- ✅ CIEDE2000 com 7 funções de peso
- ✅ Remoção de outliers (IQR)
- ✅ Média ponderada robusta
- ✅ Validação luminância (5%-98%)
- ✅ Validação equilíbrio RGB
- ✅ Validação variação de luz
- ✅ Scoring de qualidade (0-100%)
- ✅ Endpoint robosto no proxy (/capture-robust-sample)
- ✅ Hook useRobustColorCalibration
- ✅ Hook useCameraRobustCapture
- ✅ UI atualizada (ColorCapture.tsx)
- ✅ Padrões CIE D65, A, F2
- ✅ Tolerâncias para têxteis

---

## 📚 Referências

- **CIE CIEDE2000**: Specification for DeltaE (DE00) - CIE/ISO 11664-2:2022
- **sRGB**: IEC 61966-2-1:1999
- **D65 Illuminant**: CIE 15:2004
- **Textile Color Matching**: ISO 3668
- **Meta-Classificador**: Implementação original em Unity C#

---

## 🔗 Conexão com Meta-Classificador-Tecidos

A implementação replica fielmente os algoritmos do projeto meta:

| Componente | Meta (Unity C#) | Fabric (TypeScript) |
|-----------|-----------------|-------------------|
| RGB→XYZ | `color_converter.cs` | ✅ colorSpaceConversion.ts |
| XYZ→LAB | `color_converter.cs` | ✅ colorSpaceConversion.ts |
| CIEDE2000 | `ColorConverter.CalculateDeltaE2000` | ✅ calculateDeltaE2000 |
| IQR Outliers | `ColorCapture_UI.RemoveColorOutliers` | ✅ removeColorOutliers |
| Robust Mean | `ColorCapture_UI.CalculateRobustColorMean` | ✅ calculateRobustColorMean |
| Validação | `ColorCapture_UI.ValidateImprovedLightCalibration` | ✅ validateLightCalibration |
| D65 Padrão | `color_converter.cs` linha 27-30 | ✅ colorimetricStandards.ts |

---

## 🎨 Próximos Passos Opcionais

1. **Análise Multi-Ponto**: Implementar amostragem em múltiplos pontos da ROI (9 ou 18 pontos)
2. **Histograma de LAB**: Visualizar distribuição no espaço LAB
3. **Relatório de Calibração**: Salvar PDF com métricas detalhadas
4. **Comparação de Lotes**: Acompanhar variação de cor entre lotes
5. **Perfil ICC Customizado**: Gerar ICC profile específico para setup
