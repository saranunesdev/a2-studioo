import type { PayMethod, Role, Stage, TicketStatus } from '../lib/types';

export const IMG_W = 880;
export const IMG_H = 1320;

export const CATS = [
  'Signos', 'Palavras', 'Frases', 'Borboletas', 'Infinito', 'Time', 'Bandas', 'Profissões', 'Números',
  'Fundo do mar', 'Pet', 'Carros', 'Tema festa', 'Dupla', 'Música', 'Esportes', 'Natureza', 'Outubro Rosa',
  'Místico & cultural', 'Minimalistas',
];
export const CATS_EN: Record<string, string> = {
  Signos: 'Zodiac', Palavras: 'Words', Frases: 'Quotes', Borboletas: 'Butterflies', Infinito: 'Infinity',
  Time: 'Football clubs', Bandas: 'Bands', 'Profissões': 'Professions', 'Números': 'Numbers',
  'Fundo do mar': 'Ocean', Pet: 'Pets', Carros: 'Cars', 'Tema festa': 'Party', Dupla: 'Matching',
  'Música': 'Music', Esportes: 'Sports', Natureza: 'Nature', 'Outubro Rosa': 'Pink October',
  'Místico & cultural': 'Mystic & cultural', Minimalistas: 'Minimalist',
};

export const EVENT_TYPES = ['Casamento', 'Formatura', 'Festival/show', 'Festa corporativa', 'Feira'];
export const TYPE_CATS: Record<string, string[]> = {
  Casamento: ['Dupla', 'Frases', 'Palavras', 'Infinito', 'Minimalistas', 'Tema festa', 'Borboletas', 'Signos'],
  Formatura: ['Profissões', 'Frases', 'Palavras', 'Números', 'Dupla', 'Signos', 'Minimalistas'],
  'Festival/show': ['Bandas', 'Música', 'Tema festa', 'Minimalistas', 'Signos', 'Frases', 'Palavras', 'Místico & cultural'],
  'Festa corporativa': ['Profissões', 'Minimalistas', 'Frases', 'Palavras', 'Signos', 'Pet'],
  Feira: [],
};
export const STUDIO_STYLES = ['Fineline', 'Blackwork', 'Realismo', 'Neotrad', 'Cobertura', 'Reformas'];
export const LANGS = ['Português', 'Inglês', 'Espanhol', 'Libras', 'Japonês', 'Italiano', 'Francês'];
export const LEVELS = ['Iniciante', 'Intermediário', 'Sênior'];
export const ROLES: Record<Role, string> = { tatuador: 'Tatuador(a)', atendimento: 'Atendimento', piercer: 'Piercer' };
export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
export const WDL: Record<string, string> = { dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' };
export const STAGES: [Stage, string][] = [
  ['negociacao', 'Negociação'], ['orcamento', 'Orçamento'], ['contrato', 'Contrato'],
  ['confirmado', 'Confirmado'], ['realizado', 'Realizado'], ['fechado', 'Fechado'],
];
export const STAGE_L = Object.fromEntries(STAGES) as Record<Stage, string>;
export const STEPS: [string, string][] = [
  ['negociacao', 'Negociação com o parceiro'], ['orcamento', 'Orçamento aprovado'],
  ['contrato_parceiro', 'Contrato do parceiro assinado'], ['contratos_tatuadores', 'Contratos da equipe assinados'],
  ['compras', 'Compras de insumos'], ['treinamento', 'Treinamento da equipe'],
  ['logistica', 'Logística e transporte'], ['divulgacao', 'Divulgação'],
];
export const CONTRACT = ['pendente', 'enviado', 'assinado'] as const;
export const CHK_ST: [string, string][] = [
  ['faltando', 'Faltando'], ['comprar', 'Comprar'], ['separado', 'Separado'], ['embalado', 'No carro'], ['voltou', 'Voltou'],
];
export const CHK_L = Object.fromEntries(CHK_ST);
export const CHK_GROUPS = ['Equipamentos', 'Insumos', 'Biossegurança', 'Stand', 'Pós-atendimento', 'Documentos'];
export const CARE_DAYS = [1, 3, 7, 14, 20];
export const BODY = ['Pulso', 'Antebraço', 'Braço', 'Ombro', 'Costela', 'Costas', 'Nuca', 'Tornozelo', 'Pé', 'Perna', 'Mão/dedo', 'Outro'];
export const BODY_EN: Record<string, string> = {
  Pulso: 'Wrist', 'Antebraço': 'Forearm', 'Braço': 'Arm', Ombro: 'Shoulder', Costela: 'Ribs', Costas: 'Back',
  Nuca: 'Nape', Tornozelo: 'Ankle', 'Pé': 'Foot', Perna: 'Leg', 'Mão/dedo': 'Hand/finger', Outro: 'Other',
};
export const PAY: Record<PayMethod, string> = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };
export const STATUS: Record<TicketStatus, string> = {
  aguardando_pagamento: 'Falta pagar', na_fila: 'Na fila', chamado: 'Chamado', em_atendimento: 'Tatuando',
  concluido: 'Pronta', cancelado: 'Cancelado',
};
export const HEALTH: [string, string, string][] = [
  ['diabetes', 'Diabetes', 'Diabetes'],
  ['hipertensao', 'Pressão alta ou baixa', 'High or low blood pressure'],
  ['cardiaco', 'Problema no coração ou marca-passo', 'Heart condition or pacemaker'],
  ['coagulacao', 'Hemofilia ou problema de coagulação', 'Haemophilia or clotting problem'],
  ['anticoagulante', 'Tomou anticoagulante, AAS ou anti-inflamatório (últimos 7 dias)', 'Took blood thinners, aspirin or anti-inflammatories (last 7 days)'],
  ['epilepsia', 'Epilepsia ou convulsões', 'Epilepsy or seizures'],
  ['infecciosa', 'Hepatite, HIV ou outra doença contagiosa', 'Hepatitis, HIV or another contagious disease'],
  ['alergia', 'Alergia (látex, tinta, cosméticos, remédios)', 'Allergy (latex, ink, cosmetics, medicine)'],
  ['queloide', 'Queloide ou cicatrização difícil', 'Keloids or poor healing'],
  ['pele', 'Problema de pele no local (psoríase, dermatite, ferida)', 'Skin problem on the spot (psoriasis, dermatitis, wound)'],
  ['gestante', 'Grávida ou amamentando', 'Pregnant or breastfeeding'],
  ['medicamento', 'Toma remédio todo dia', 'Take daily medication'],
  ['alcool', 'Bebeu álcool nas últimas 24 h', 'Drank alcohol in the last 24 h'],
  ['jejum', 'Não comeu nas últimas 4 h', 'Have not eaten in the last 4 h'],
  ['desmaio', 'Já desmaiou com agulha ou sangue', 'Have fainted with needles or blood'],
];
export const HEALTH_L = Object.fromEntries(HEALTH.map(([k, l]) => [k, l]));

export const MODULES = [
  { id: 'bio', short: 'Bio', name: 'Biossegurança e EPIs', items: ['Higienizar as mãos antes e depois de cada atendimento.', 'Luvas nitrílicas novas a cada cliente e sempre que tocar algo fora da área de trabalho.', 'Barreiras plásticas na máquina, cabo, borrifador e luminária, trocadas a cada cliente.', 'Abrir agulhas, cartuchos e lâminas descartáveis na frente do cliente.'] },
  { id: 'cruzada', short: 'Cruz', name: 'Contaminação cruzada', items: ['Separar área limpa e área suja na mesa.', 'Tinta em batoque individual; o que sobra é descartado e nunca volta ao frasco.', 'Não tocar celular, caneta, cabelo ou maquininha de cartão de luva.', 'Limpar a mesa e a maca com álcool 70% entre um cliente e outro.'] },
  { id: 'perfuro', short: 'Perf', name: 'Acidentes com perfurocortantes', items: ['Descartar agulhas e lâminas na hora, no coletor rígido. Nunca reencapar.', 'Em caso de acidente: lavar com água e sabão, avisar a responsável e registrar o ocorrido.', 'Procurar um serviço de saúde o quanto antes para avaliação de profilaxia.'] },
  { id: 'socorros', short: 'SOS', name: 'Primeiros socorros', items: ['Tontura ou queda de pressão: parar, deitar a pessoa, elevar as pernas e oferecer água ou algo doce quando estiver consciente.', 'Sangramento fora do normal: compressão com gaze limpa.', 'Falta de ar, inchaço no rosto ou desmaio que não passa: ligar 192 (SAMU).', 'Saber onde fica o kit de primeiros socorros e o pronto atendimento mais próximo do evento.'] },
  { id: 'vigilancia', short: 'Visa', name: 'Regras da vigilância sanitária', items: ['Ter a licença ou os documentos sanitários exigidos pelo município para atendimento externo.', 'Usar só produtos e pigmentos regularizados na Anvisa, dentro da validade.', 'Guardar as fichas de anamnese de todos os clientes.', 'Lixo infectante e coletor de perfurocortante recolhidos por empresa licenciada.', 'Menores de idade só com autorização e presença do responsável. Confira a regra do seu estado.'] },
  { id: 'app', short: 'App', name: 'Fila e atendimento pelo app', items: ['Conferir o código do cliente e confirmar o pagamento no app.', 'Ler os alertas da ficha antes de começar a tatuar.', 'Ao terminar, tocar em “Liberar mesa”: o próximo da fila é chamado na hora.', 'Se a pessoa não aparecer em 10 minutos, tocar em “Não apareceu”.'] },
];

export const SIZE_CM: Record<string, string> = { P: 'até 5 cm', M: '5 a 8 cm', G: '8 a 12 cm' };
export const SIZE_CM_EN: Record<string, string> = { P: 'up to 5 cm', M: '5 to 8 cm', G: '8 to 12 cm' };
export const DEFAULT_PRICES = { F: { P: 150, M: 200, G: 260 }, D: { P: null, M: 280, G: 360 } };
