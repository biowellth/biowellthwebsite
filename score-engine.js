/* score-engine.js
   Loaded by dashboard.html. Single source of truth for functional ranges and the deterministic vitality score.
   Loaded as a plain <script src>; everything attaches to window. */

const FUNCTIONAL_RANGES = {
  'Total Cholesterol':{unit:'mg/dL',clinical:[130,240],functional:[165,199],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'Total Cholesterol',explain:'200-239 borderline high | Context matters; focus on ApoB/Non‑HDL'},
  'HDL Cholesterol':{unit:'mg/dL',clinical:[50,80],functional:[60,80],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'higher',display:'HDL Cholesterol',explain:'Higher is better | Higher is generally protective',aliases:['HDL','HDL-C','HDL - Direct','HDL Cholesterol - Direct']},
  'LDL Cholesterol':{unit:'mg/dL',clinical:[40,100],functional:[70,99],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'LDL Cholesterol',explain:'100-129 near optimal; 130-159 borderline',aliases:['LDL','LDL-C','LDL - Direct','LDL Cholesterol - Direct']},
  'Triglycerides':{unit:'mg/dL',clinical:[40,150],functional:[45,90],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'Triglycerides',explain:'150-199 borderline'},
  'VLDL Cholesterol':{unit:'mg/dL',clinical:[5,30],functional:[10,20],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'VLDL Cholesterol',explain:'≈ TG/5 (fasting)'},
  'Non-HDL Cholesterol':{unit:'mg/dL',clinical:[0,160],functional:[0,100],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'Non-HDL Cholesterol',explain:'Non-HDL = TC - HDL'},
  'LDL/HDL ratio':{unit:'ratio',clinical:[0,3.5],functional:[0,2],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'LDL/HDL ratio',explain:'Lower is better'},
  'Total/HDL ratio':{unit:'ratio',clinical:[2.5,4.4],functional:[2.5,3],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'Total/HDL ratio',explain:'Lower is better'},
  'Triglyceride/HDL ratio':{unit:'ratio',clinical:[0.5,3],functional:[0.5,1.5],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'Triglyceride/HDL ratio',explain:'Lower is better'},
  'Apolipoprotein B':{unit:'mg/dL',clinical:[60,130],functional:[60,80],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'Apolipoprotein B',explain:'Aim <65 mg/dL if very high ASCVD risk',aliases:['ApoB','Apo B','APO-B']},
  'Apolipoprotein A1':{unit:'mg/dL',clinical:[94,200],functional:[140,180],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'higher',display:'Apolipoprotein A1',explain:'Higher is generally better',aliases:['ApoA1','Apo A1','APO-A1']},
  'ApoB/ApoA1 ratio':{unit:'ratio',clinical:[0.45,0.8],functional:[0.45,0.6],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'ApoB/ApoA1 ratio',explain:'Lower is better'},
  'Lipoprotein(a)':{unit:'mg/dL',clinical:[0,50],functional:[0,30],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'Lipoprotein(a)',explain:'30-50 intermediate; nmol/L common',aliases:['Lp(a)','LPA','Lp a']},
  'LP-PLA2':{unit:'ng/mL',clinical:[0,284],functional:[0,200],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'lower',display:'LP-PLA2',explain:'235-284 borderline; or activity unit'},
  'Small LDL':{unit:'nmol/L',clinical:[0,527],functional:[0,200],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Small LDL',explain:'Lower is better'},
  'LDL-P':{unit:'nmol/L',clinical:[0,1300],functional:[0,1000],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'LDL-P',explain:'LDL particle number; commonly reported on NMR/Cardio IQ-style panels.'},
  'Small LDL-P':{unit:'nmol/L',clinical:[0,840],functional:[0,527],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Small LDL-P',explain:'Small LDL particle number; lab-dependent cutoffs (NMR/Cardio IQ conventions).'},
  'HDL-P':{unit:'µmol/L',clinical:[29,99999],functional:[33,99999],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'HDL-P',explain:'HDL particle number; some labs flag low <29.'},
  'Large HDL-P':{unit:'µmol/L',clinical:[5,99999],functional:[7.2,99999],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Large HDL-P',explain:'Large HDL particle number; lab-dependent.'},
  'HDL Size':{unit:'nm',clinical:[8.7,99999],functional:[9,99999],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'HDL Size',explain:'Average HDL particle size; lab-dependent.'},
  'LDL Size':{unit:'nm',clinical:[20.5,99999],functional:[20.5,99999],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'LDL Size',explain:'Average LDL particle size; <20.5 often aligns with Pattern B (more atherogenic).'},
  'VLDL Size':{unit:'nm',clinical:[0,44.6],functional:[0,44.6],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'VLDL Size',explain:'Average VLDL particle size; lab-dependent.'},
  'Large VLDL-P':{unit:'nmol/L',clinical:[0,2.7],functional:[0,2.7],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Large VLDL-P',explain:'Large VLDL particle number; lab-dependent.'},
  'ADMA':{unit:'µmol/L',clinical:[0,0.75],functional:[0,0.6],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'ADMA',explain:'Asymmetric dimethylarginine; endothelial function marker; lab-dependent.'},
  'SDMA':{unit:'µmol/L',clinical:[0,0.9],functional:[0,0.9],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'SDMA',explain:'Symmetric dimethylarginine; renal/vascular risk signal; lab-dependent.'},
  'Atherogenic Index of Plasma (AIP)':{unit:'calculated index',clinical:[0,0.21],functional:[0,0.11],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Atherogenic Index of Plasma (AIP)',explain:'Computed: log10(TG/HDL-C) using molar units; interpretive ranges.'},
  'Atherogenic Coefficient':{unit:'calculated index',clinical:[0,4],functional:[0,3],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Atherogenic Coefficient',explain:'Computed: (Total Cholesterol − HDL)/HDL; interpretive ranges.'},
  'LDL-C / ApoB':{unit:'ratio',clinical:[1.2,99999],functional:[1.2,99999],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'LDL-C / ApoB',explain:'Computed ratio; lower suggests cholesterol-poor, particle-dense LDL (discordance risk).'},
  'TG / ApoB':{unit:'ratio',clinical:[0,1.25],functional:[0,1.25],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'TG / ApoB',explain:'Computed ratio; higher can track insulin resistance/atherogenic dyslipidemia.'},
  'Uric Acid / HDL-C':{unit:'ratio',clinical:[0,0.15],functional:[0,0.15],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Uric Acid / HDL-C',explain:'Computed ratio; interpretive.'},
  'Non-HDL-C / ApoB':{unit:'ratio',clinical:[0,1.3],functional:[0,1.3],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Non-HDL-C / ApoB',explain:'Computed ratio; interpretive.'},
  'Coenzyme Q10':{unit:'ug/ml',clinical:[0.4,2.2],functional:[1,1.5],category:'metabolic',subcategory:'Cardiovascular & Lipid Markers',direction:'range',display:'Coenzyme Q10',explain:''},
  'hs-CRP':{unit:'mg/L',clinical:[0.2,3],functional:[0.2,0.9],category:'inflammation',subcategory:'Inflammation & Immune Markers',direction:'lower',display:'hs-CRP',explain:'Acute illness elevates',aliases:['hsCRP','HS-CRP','High Sensitivity CRP','High Sensitivity C-Reactive Protein']},
  'Homocysteine':{unit:'µmol/L',clinical:[0,15],functional:[0,8],category:'inflammation',subcategory:'Inflammation & Immune Markers',direction:'lower',display:'Homocysteine',explain:'10-15 borderline high'},
  'Erythrocyte Sedimentation Rate (ESR)':{unit:'mm/hr',clinical:[0,10],functional:[0,10],category:'inflammation',subcategory:'Inflammation & Immune Markers',direction:'lower',display:'ESR',explain:'Age-dependent',aliases:['ESR']},
  'Immunoglobulin A (IgA)':{unit:'mg/dL',clinical:[70,400],functional:[100,300],category:'inflammation',subcategory:'Inflammation & Immune Markers',direction:'range',display:'Immunoglobulin A (IgA)',explain:'Adults; lab-specific'},
  'Immunoglobulin G (IgG)':{unit:'mg/dL',clinical:[700,1600],functional:[900,1400],category:'inflammation',subcategory:'Inflammation & Immune Markers',direction:'range',display:'Immunoglobulin G (IgG)',explain:'Adults; lab-specific'},
  'Immunoglobulin M (IgM)':{unit:'mg/dL',clinical:[40,230],functional:[70,190],category:'inflammation',subcategory:'Inflammation & Immune Markers',direction:'range',display:'Immunoglobulin M (IgM)',explain:'Adults; lab-specific'},
  'Total IgE':{unit:'IU/mL',clinical:[0,100],functional:[0,100],category:'inflammation',subcategory:'Inflammation & Immune Markers',direction:'range',display:'Total IgE',explain:'Age/atopy dependent'},
  'ANA (Antinuclear Antibodies)':{unit:'Positive: 1 Negative: 0',clinical:[0,0],functional:[0,0],category:'inflammation',subcategory:'Autoimmune & Rheumatologic Markers',direction:'lower',display:'ANA',explain:'Titer/pattern reported',aliases:['ANA','Anti-Nuclear Antibodies','Antinuclear Antibodies']},
  'Rheumatoid Factor (RF)':{unit:'IU/mL',clinical:[0,14],functional:[0,14],category:'inflammation',subcategory:'Autoimmune & Rheumatologic Markers',direction:'range',display:'Rheumatoid Factor (RF)',explain:'Assay-specific'},
  'Anti-CCP (ACCP)':{unit:'U/mL',clinical:[0,20],functional:[0,20],category:'inflammation',subcategory:'Autoimmune & Rheumatologic Markers',direction:'lower',display:'Anti-CCP',explain:'Assay-specific',aliases:['Anti-CCP','ACCP']},
  'Anti-Streptolysin O (ASO)':{unit:'IU/mL',clinical:[0,200],functional:[0,200],category:'inflammation',subcategory:'Autoimmune & Rheumatologic Markers',direction:'range',display:'Anti-Streptolysin O (ASO)',explain:'Varies by age/lab'},
  'Fasting Glucose':{unit:'mg/dL',clinical:[70,126],functional:[80,90],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'range',display:'Fasting Glucose',explain:'100-125 prediabetes'},
  'Average Glucose':{unit:'mg/dL',clinical:[0,140],functional:[0,117],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'range',display:'Average Glucose',explain:''},
  'Hemoglobin A1c (HbA1c)':{unit:'%',clinical:[4,6.5],functional:[4.2,5.2],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'lower',display:'HbA1c',explain:'5.7-6.4 prediabetes',aliases:['HbA1c','A1c','Glycated Hemoglobin']},
  'Fasting Insulin':{unit:'µIU/mL',clinical:[2,20],functional:[2,6],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'lower',display:'Fasting Insulin',explain:'',aliases:['Insulin']},
  'HOMA-IR':{unit:'calculated index',clinical:[0.5,2.9],functional:[0.5,1.3],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'lower',display:'HOMA-IR',explain:''},
  'C-Peptide':{unit:'ng/mL',clinical:[0.8,5],functional:[1,2],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'range',display:'C-Peptide',explain:'Fasting reference'},
  'Fructosamine':{unit:'µmol/L',clinical:[205,285],functional:[215,255],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'lower',display:'Fructosamine',explain:'2-3 week window'},
  'Leptin':{unit:'ng/mL',clinical:[4,20],functional:[4,15],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'range',display:'Leptin',explain:'Interpret by body comp | Approximate target for BMI 20-25; interpret by body comp'},
  'Blood Ketones':{unit:'mmol/L',clinical:[0,3],functional:[0.1,0.3],category:'metabolic',subcategory:'Glucose, Insulin & Energy Regulation',direction:'range',display:'Blood Ketones',explain:''},
  'TSH':{unit:'mIU/L',clinical:[0.4,4.5],functional:[1,2],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'TSH',explain:'Some feel best ~1-2',aliases:['Thyroid Stimulating Hormone','TSH - Ultrasensitive','Ultrasensitive TSH']},
  'Free T4':{unit:'ng/dL',clinical:[0.8,1.8],functional:[1.1,1.5],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Free T4',explain:''},
  'Free T3':{unit:'pg/mL',clinical:[2.3,4.2],functional:[2.8,3.3],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Free T3',explain:''},
  'Total T4':{unit:'µg/dL',clinical:[5,12],functional:[5,12],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Total T4',explain:''},
  'Total T3':{unit:'ng/dL',clinical:[80,200],functional:[80,200],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Total T3',explain:''},
  'Reverse T3':{unit:'ng/dL',clinical:[8,20],functional:[10,15],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Reverse T3',explain:'Assay-specific'},
  'Free T4 Index (T7)':{unit:'calculated index',clinical:[1,4],functional:[1,4],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Free T4 Index (T7)',explain:'Legacy index; lab reference intervals vary.'},
  'Thyroid Peroxidase Antibodies (TPOAb)':{unit:'IU/mL',clinical:[9,35],functional:[9,35],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Thyroid Peroxidase Antibodies (TPOAb)',explain:'> 35 = Positive'},
  'Thyroglobulin Antibodies (TGAb/ATG)':{unit:'IU/mL',clinical:[0,1],functional:[0,1],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Thyroglobulin Antibodies (TGAb/ATG)',explain:'> 4 = Positive'},
  'Thyroglobulin':{unit:'ng/mL',clinical:[0,30],functional:[0,30],category:'thyroid',subcategory:'Thyroid Function',direction:'range',display:'Thyroglobulin',explain:'Interpret with thyroid status'},
  'Cortisol':{unit:'µg/dL',clinical:[6,20],functional:[10,15],category:'stress',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Cortisol',explain:'Diurnal: PM lower'},
  'DHEA-S':{unit:'µg/dL',clinical:[35,430],functional:[35,430],category:'stress',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'DHEA-S',explain:'Age dependent',aliases:['DHEAS','DHEA-Sulphate','DHEA Sulfate']},
  '17-Hydroxyprogesterone':{unit:'ng/dL',clinical:[0,200],functional:[0,200],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'17-Hydroxyprogesterone',explain:'Phase dependent',aliases:['17-OH-Progesterone','17-OH-P','17-OHP','17-Hydroxyprogesterone']},
  'Androstenedione':{unit:'ng/dL',clinical:[40,190],functional:[80,150],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Androstenedione',explain:'Age/assay dependent Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Corticosterone':{unit:'ng/dL',clinical:[53,1560],functional:[100,400],category:'stress',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Corticosterone',explain:'Assay-specific'},
  '11-Deoxycortisol':{unit:'ng/dL',clinical:[10,79],functional:[10,40],category:'stress',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'11-Deoxycortisol',explain:'Often for CAH testing',aliases:['Deoxycortisol']},
  'Aldosterone':{unit:'ng/dL',clinical:[3,30],functional:[7,20],category:'stress',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Aldosterone',explain:'Posture/sodium/meds dependent'},
  'Direct Renin':{unit:'ng/L',clinical:[4.4,45],functional:[10,40],category:'stress',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Direct Renin',explain:'Units vary (mU/L, ng/mL/hr PRA)'},
  'Free Androgen Index (FAI)':{unit:'calculated index',clinical:[1,5],functional:[1,5],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Free Androgen Index (FAI)',explain:'Computed: (Total T/SHBG)×100; method-dependent.'},
  'Adiponectin':{unit:'µg/mL',clinical:[7,99999],functional:[10,99999],category:'metabolic',subcategory:'Metabolic and Adipokines',direction:'range',display:'Adiponectin',explain:'Ranges vary; lower aligns with insulin resistance risk.'},
  'Corrected Calcium (albumin-adjusted)':{unit:'mg/dL',clinical:[9,10.2],functional:[9.2,9.8],category:'metabolic',subcategory:'Metabolic and Adipokines',direction:'range',display:'Corrected Calcium (albumin-adjusted)',explain:'Albumin-adjusted; formulas vary slightly by lab.'},
  'Systemic Immune-Inflammation Index (SII)':{unit:'calculated index',clinical:[0,500],functional:[0,500],category:'inflammation',subcategory:'Immune-Inflammation Index',direction:'range',display:'Systemic Immune-Inflammation Index (SII)',explain:'Computed: (Platelets×Neutrophils)/Lymphocytes; interpretive.'},
  'Systemic Inflammation Response Index (SIRI)':{unit:'calculated index',clinical:[0,1],functional:[0,1],category:'inflammation',subcategory:'Immune-Inflammation Index',direction:'range',display:'Systemic Inflammation Response Index (SIRI)',explain:'Computed: (Neutrophils×Monocytes)/Lymphocytes; interpretive.'},
  'ALT (SGPT)':{unit:'U/L',clinical:[7,55],functional:[17,23],category:'liver',subcategory:'Liver Function',direction:'lower',display:'ALT (SGPT)',explain:'Lab-specific',aliases:['ALT','SGPT','Alanine Aminotransferase','Alanine Transaminase']},
  'AST (SGOT)':{unit:'U/L',clinical:[8,48],functional:[12,26],category:'liver',subcategory:'Liver Function',direction:'lower',display:'AST (SGOT)',explain:'Lab-specific',aliases:['AST','SGOT','Aspartate Aminotransferase']},
  'GGT':{unit:'U/L',clinical:[9,48],functional:[10,30],category:'liver',subcategory:'Liver Function',direction:'lower',display:'GGT',explain:'Lab-specific',aliases:['Gamma GT','Gamma Glutamyl Transferase']},
  'Alkaline Phosphatase':{unit:'U/L',clinical:[44,147],functional:[50,100],category:'liver',subcategory:'Liver Function',direction:'lower',display:'Alkaline Phosphatase',explain:'Age/sex dependent',aliases:['ALP']},
  'Bilirubin (Total)':{unit:'mg/dL',clinical:[0.3,1.2],functional:[0.6,1],category:'liver',subcategory:'Liver Function',direction:'lower',display:'Total bilirubin',explain:'Gilbert\'s may be 1-3',aliases:['Total Bilirubin','Bilirubin Total','Bilirubin']},
  'Bilirubin (Direct)':{unit:'mg/dL',clinical:[0.1,0.3],functional:[0.1,0.2],category:'liver',subcategory:'Liver Function',direction:'lower',display:'Direct bilirubin',explain:'',aliases:['Direct Bilirubin','Bilirubin Direct','Conjugated Bilirubin']},
  'Bilirubin (Indirect)':{unit:'mg/dL',clinical:[0.2,0.9],functional:[0.4,0.8],category:'liver',subcategory:'Liver Function',direction:'lower',display:'Indirect bilirubin',explain:'',aliases:['Indirect Bilirubin','Bilirubin Indirect','Unconjugated Bilirubin']},
  'LDH':{unit:'U/L',clinical:[150,280],functional:[150,220],category:'liver',subcategory:'Liver Function',direction:'range',display:'LDH',explain:'Broad reference range'},
  'Albumin':{unit:'g/dL',clinical:[3.5,5],functional:[4.2,4.8],category:'liver',subcategory:'Liver Function',direction:'range',display:'Albumin',explain:'',aliases:['Serum Albumin']},
  'Total Protein':{unit:'g/dL',clinical:[6,8.3],functional:[6.8,7.6],category:'liver',subcategory:'Liver Function',direction:'range',display:'Total Protein',explain:'',aliases:['Protein - Total','Serum Protein']},
  'Albumin/Globulin (A/G) ratio':{unit:'ratio',clinical:[1.2,1.8],functional:[1.2,1.8],category:'liver',subcategory:'Liver Function',direction:'range',display:'Albumin/Globulin (A/G) ratio',explain:'Low ratio may indicate ↑globulins',aliases:['A/G Ratio','A/G','Albumin Globulin Ratio']},
  'BUN':{unit:'mg/dL',clinical:[7,20],functional:[10,18],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'lower',display:'BUN',explain:''},
  'Creatinine':{unit:'mg/dL',clinical:[0.6,1.1],functional:[0.7,1],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'lower',display:'Creatinine',explain:'Muscle mass dependent'},
  'eGFR':{unit:'mL/min/1.73m²',clinical:[60,99999],functional:[60,99999],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'higher',display:'eGFR',explain:'≥90 normal; 60-89 mild↓'},
  'Cystatin C':{unit:'mg/L',clinical:[0.6,1],functional:[0.7,0.95],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'lower',display:'Cystatin C',explain:'Lab-specific'},
  'Uric Acid':{unit:'mg/dL',clinical:[2.4,6],functional:[3,4.5],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'lower',display:'Uric Acid',explain:''},
  'BUN/Creatinine ratio':{unit:'ratio',clinical:[10,20],functional:[12,18],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'BUN/Creatinine ratio',explain:'Hydration/protein intake affect'},
  'Sodium':{unit:'mmol/L',clinical:[135,145],functional:[139,142],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'Sodium',explain:''},
  'Potassium':{unit:'mmol/L',clinical:[3.5,5],functional:[4,4.6],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'Potassium',explain:''},
  'Chloride':{unit:'mmol/L',clinical:[98,106],functional:[100,104],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'Chloride',explain:''},
  'CO₂ (Bicarbonate)':{unit:'mmol/L',clinical:[22,29],functional:[24,28],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'CO₂ (Bicarbonate)',explain:''},
  'Calcium':{unit:'mg/dL',clinical:[8.6,10.2],functional:[9.2,9.8],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'Calcium',explain:'Correct for albumin if abnormal',aliases:['Serum Calcium']},
  'Phosphorus':{unit:'mg/dL',clinical:[2.5,4.5],functional:[3,4],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'Phosphorus',explain:''},
  'Urinary Microalbumin':{unit:'mg/L',clinical:[0,20],functional:[0,20],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'lower',display:'Urinary Microalbumin',explain:'Often via UACR',aliases:['Microalbumin']},
  'Urine Creatinine':{unit:'mg/dL',clinical:[50,320],functional:[50,150],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'range',display:'Urine Creatinine',explain:'Highly variable; use UACR'},
  'Urine Albumin/Creatinine Ratio (UACR)':{unit:'mg/g',clinical:[0,30],functional:[0,10],category:'kidney',subcategory:'Kidney Function & Electrolytes',direction:'lower',display:'Urine Albumin/Creatinine Ratio (UACR)',explain:'30-300 micro; >300 macro',aliases:['Urine Albumin/Creatinine Ratio','UACR','UA/C','Albumin/Creatinine Ratio']},
  'Amylase':{unit:'U/L',clinical:[40,110],functional:[40,90],category:'liver',subcategory:'Pancreas',direction:'lower',display:'Amylase',explain:'Lab-specific'},
  'Lipase':{unit:'U/L',clinical:[10,60],functional:[10,55],category:'liver',subcategory:'Pancreas',direction:'lower',display:'Lipase',explain:'Lab-specific'},
  'Vitamin D (25-OH total)':{unit:'ng/mL',clinical:[20,100],functional:[35,50],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin D total',explain:'20-29 insufficiency',aliases:['Vitamin D','Vitamin D Total','Vitamin D - 25 Hydroxy','25-Hydroxyvitamin D','25(OH)D']},
  'Vitamin A':{unit:'µg/dL',clinical:[20,80],functional:[30,50],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin A',explain:''},
  'Vitamin E':{unit:'mg/L',clinical:[5.5,20],functional:[9,16],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin E',explain:''},
  'Vitamin K':{unit:'ng/mL',clinical:[0.5,3.2],functional:[0.5,2],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin K',explain:'Assay-specific'},
  'Vitamin B1 (Thiamin)':{unit:'nmol/L',clinical:[70,180],functional:[100,150],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin B1 (Thiamin)',explain:'Whole blood/ETKase preferred',aliases:['Vitamin B1','Thiamin','Thiamine']},
  'Vitamin B2 (Riboflavin)':{unit:'µg/L',clinical:[5,50],functional:[10,40],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin B2 (Riboflavin)',explain:'Assay-specific',aliases:['Vitamin B2','Riboflavin']},
  'Vitamin B3 (Niacin)':{unit:'µg/mL',clinical:[1,8],functional:[1,5],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin B3 (Niacin)',explain:'As nicotinamide; assay varies',aliases:['Vitamin B3','Niacin','Nicotinic Acid']},
  'Vitamin B5 (Pantothenic acid)':{unit:'µg/L',clinical:[1,5],functional:[1.5,3.5],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin B5',explain:'Assay-specific',aliases:['Vitamin B5','Pantothenic Acid']},
  'Vitamin B6 (PLP)':{unit:'ng/mL',clinical:[5,100],functional:[10,30],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin B6',explain:'Reported as PLP',aliases:['Vitamin B6','P5P','PLP','Pyridoxal-5-phosphate']},
  'Vitamin B7 (Biotin)':{unit:'ng/L',clinical:[0.2,0.8],functional:[0.2,0.6],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin B7 (Biotin)',explain:'Assay-specific',aliases:['Vitamin B7','Biotin']},
  'Vitamin B9 (Folate)':{unit:'ng/mL',clinical:[3,20],functional:[7,18],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Folate (B9)',explain:'RBC folate preferred',aliases:['Vitamin B9','Folate','Folic Acid']},
  'Vitamin B12':{unit:'pg/mL',clinical:[200,1000],functional:[500,900],category:'vitamins',subcategory:'Vitamins',direction:'range',display:'Vitamin B12',explain:'200-399 indeterminate; check MMA/HCY'},
  'Iron':{unit:'µg/dL',clinical:[60,170],functional:[80,120],category:'iron',subcategory:'Minerals & Trace Elements',direction:'range',display:'Iron',explain:'Interpret with ferritin/TIBC',aliases:['Serum Iron']},
  'Ferritin':{unit:'ng/mL',clinical:[12,200],functional:[40,80],category:'iron',subcategory:'Minerals & Trace Elements',direction:'range',display:'Ferritin',explain:'Inflammation elevates ferritin'},
  'Iron Saturation':{unit:'%',clinical:[15,45],functional:[25,35],category:'iron',subcategory:'Minerals & Trace Elements',direction:'range',display:'Iron Saturation',explain:'Transferrin saturation',aliases:['Transferrin Saturation','% Transferrin Saturation']},
  'Transferrin':{unit:'mg/dL',clinical:[200,360],functional:[250,330],category:'iron',subcategory:'Minerals & Trace Elements',direction:'range',display:'Transferrin',explain:''},
  'TIBC':{unit:'µg/dL',clinical:[240,450],functional:[300,360],category:'iron',subcategory:'Minerals & Trace Elements',direction:'range',display:'TIBC',explain:''},
  'Iodine':{unit:'µg/L',clinical:[40,300],functional:[40,300],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Iodine',explain:'Urine population targets'},
  'Selenium':{unit:'µg/L',clinical:[70,150],functional:[110,140],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Selenium',explain:''},
  'Copper':{unit:'µg/dL',clinical:[70,140],functional:[100,140],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Copper',explain:'',aliases:['Serum Copper']},
  'Zinc':{unit:'µg/dL',clinical:[70,120],functional:[90,110],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Zinc',explain:'',aliases:['Serum Zinc']},
  'Magnesium':{unit:'mg/dL',clinical:[1.7,2.6],functional:[2,2.2],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Magnesium',explain:'Serum may not reflect stores',aliases:['Serum Magnesium']},
  'Arsenic':{unit:'µg/L',clinical:[0,12],functional:[0,12],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Arsenic',explain:'Seafood arsenicals can elevate transiently'},
  'Lead':{unit:'µg/dL',clinical:[0,3.5],functional:[0,3.5],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Lead',explain:'CDC adult reference; no safe level'},
  'Cadmium':{unit:'µg/L',clinical:[0,1],functional:[0,1],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Cadmium',explain:'Smokers may be higher'},
  'Mercury':{unit:'µg/L',clinical:[0,10],functional:[0,10],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Mercury',explain:'Species-dependent (methyl vs inorganic)'},
  'Chromium':{unit:'µg/L',clinical:[0,1.4],functional:[0,1.4],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Chromium',explain:'Occupational exposure dependent'},
  'Barium':{unit:'µg/L',clinical:[0,10],functional:[0,10],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Barium',explain:'Lab-specific'},
  'Cobalt':{unit:'µg/L',clinical:[0,1],functional:[0,1],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Cobalt',explain:'Lab-specific'},
  'Cesium':{unit:'µg/L',clinical:[0,10],functional:[0,10],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Cesium',explain:'Lab-specific',aliases:['Caesium']},
  'Aluminum':{unit:'µg/L',clinical:[0,10],functional:[0,10],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Aluminum',explain:'Renal impairment raises',aliases:['Aluminium']},
  'Silver':{unit:'µg/L',clinical:[0,5],functional:[0,5],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Silver',explain:'Lab-specific'},
  'Beryllium':{unit:'µg/L',clinical:[0,1],functional:[0,1],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Beryllium',explain:'Lab-specific'},
  'Bismuth':{unit:'µg/L',clinical:[0,20],functional:[0,20],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Bismuth',explain:'Lab-specific'},
  'Manganese':{unit:'µg/L',clinical:[0,15],functional:[0,15],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Manganese',explain:'Lab-specific'},
  'Molybdenum':{unit:'µg/L',clinical:[0,3],functional:[0,3],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Molybdenum',explain:'Lab-specific'},
  'Nickel':{unit:'µg/L',clinical:[0,5],functional:[0,5],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Nickel',explain:'Lab-specific'},
  'Antimony':{unit:'µg/L',clinical:[0,1],functional:[0,1],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Antimony',explain:'Lab-specific'},
  'Tin':{unit:'µg/L',clinical:[0,10],functional:[0,10],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Tin',explain:'Lab-specific'},
  'Strontium':{unit:'µg/L',clinical:[0,350],functional:[0,350],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Strontium',explain:'Lab-specific'},
  'Thallium':{unit:'µg/L',clinical:[0,2],functional:[0,2],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Thallium',explain:'Lab-specific'},
  'Uranium':{unit:'µg/L',clinical:[0,0.03],functional:[0,0.03],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'lower',display:'Uranium',explain:'Lab-specific'},
  'Vanadium':{unit:'µg/L',clinical:[0,1],functional:[0,1],category:'vitamins',subcategory:'Minerals & Trace Elements',direction:'range',display:'Vanadium',explain:'Lab-specific'},
  'Hemoglobin':{unit:'g/dL',clinical:[12,16],functional:[13,14.5],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Hemoglobin',explain:'Altitude/smoking/hydration affect',aliases:['Haemoglobin','Hb','HEMOGLOBIN']},
  'Hematocrit':{unit:'%',clinical:[36,48],functional:[38,44],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Hematocrit',explain:'',aliases:['PCV','Packed Cell Volume']},
  'RBC Count':{unit:'x10^6/µL',clinical:[4.1,5.4],functional:[4.1,5.4],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'RBC Count',explain:'',aliases:['RBC','Total RBC','Red Blood Cell Count']},
  'MCV':{unit:'fL',clinical:[80,100],functional:[86,92],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'MCV',explain:'Microcytosis<80; macrocytosis>100'},
  'MCH':{unit:'pg',clinical:[27,33],functional:[28,31],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'MCH',explain:''},
  'MCHC':{unit:'g/dL',clinical:[32,36],functional:[33,35],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'MCHC',explain:''},
  'RDW-CV':{unit:'%',clinical:[11.5,14.5],functional:[11.5,13.5],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'RDW-CV',explain:''},
  'RDW-SD':{unit:'fL',clinical:[39,46],functional:[40,45],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'RDW-SD',explain:''},
  'Platelet Count':{unit:'x10^3/µL',clinical:[150,450],functional:[150,450],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Platelet Count',explain:'',aliases:['Platelets','PLT']},
  'MPV':{unit:'fL',clinical:[7.5,12.5],functional:[9,10.5],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'MPV',explain:'Lab-specific'},
  'PDW':{unit:'fL',clinical:[9,17],functional:[10,16],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'PDW',explain:'Lab-specific'},
  'Plateletcrit (PCT)':{unit:'%',clinical:[0.12,0.36],functional:[0.22,0.26],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Plateletcrit (PCT)',explain:'Instrument-dependent',aliases:['Plateletcrit','PCT']},
  'PLCR':{unit:'%',clinical:[24,42],functional:[24,40],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'PLCR',explain:'Instrument-dependent'},
  'WBC Count':{unit:'x10^3/µL',clinical:[4,11],functional:[5,7],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'WBC Count',explain:'',aliases:['WBC','TLC','Total Leucocyte Count','Total Leukocyte Count']},
  'Neutrophils (%)':{unit:'%',clinical:[40,70],functional:[55,65],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Neutrophils (%)',explain:''},
  'Lymphocytes (%)':{unit:'%',clinical:[20,40],functional:[25,35],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Lymphocytes (%)',explain:''},
  'Monocytes (%)':{unit:'%',clinical:[2,10],functional:[6,10],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Monocytes (%)',explain:''},
  'Eosinophils (%)':{unit:'%',clinical:[1,4],functional:[2,4],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Eosinophils (%)',explain:''},
  'Basophils (%)':{unit:'%',clinical:[0,1],functional:[0,1],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Basophils (%)',explain:''},
  'Absolute Neutrophils':{unit:'x10^3/µL',clinical:[1.5,7.5],functional:[2,5],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Absolute Neutrophils',explain:''},
  'Absolute Lymphocytes':{unit:'x10^3/µL',clinical:[1,4],functional:[1.5,3.5],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Absolute Lymphocytes',explain:''},
  'Absolute Monocytes':{unit:'x10^3/µL',clinical:[0.2,0.8],functional:[0.3,0.7],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Absolute Monocytes',explain:''},
  'Absolute Eosinophils':{unit:'x10^3/µL',clinical:[0.04,0.4],functional:[0.05,0.3],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Absolute Eosinophils',explain:''},
  'Absolute Basophils':{unit:'x10^3/µL',clinical:[0.01,0.1],functional:[0.02,0.1],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Absolute Basophils',explain:''},
  'Immature Granulocytes':{unit:'%',clinical:[0,0.4],functional:[0,0.4],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Immature Granulocytes',explain:'Lab-specific'},
  'Immature Granulocytes (%)':{unit:'%',clinical:[0,0.4],functional:[0,0.4],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Immature Granulocytes (%)',explain:'Dup label; instrument-specific'},
  'Nucleated RBC (count)':{unit:'x10^3/µL',clinical:[0,0],functional:[0,0],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Nucleated RBC (count)',explain:'Normally absent',aliases:['Nucleated RBC','NRBC']},
  'Nucleated RBC (%)':{unit:'%',clinical:[0,0],functional:[0,0],category:'iron',subcategory:'Hematology / Complete Blood Count',direction:'range',display:'Nucleated RBC (%)',explain:'Normally 0%'},
  'AFP':{unit:'ng/mL',clinical:[0,10],functional:[0,10],category:'other',subcategory:'Tumor Markers',direction:'lower',display:'AFP',explain:'Pregnancy elevates; lab-specific'},
  'Beta-hCG':{unit:'mIU/mL',clinical:[0,5],functional:[0,5],category:'other',subcategory:'Tumor Markers',direction:'range',display:'Beta-hCG',explain:'Pregnancy expected to be high'},
  'CEA':{unit:'ng/mL',clinical:[0,3],functional:[0,3],category:'other',subcategory:'Tumor Markers',direction:'lower',display:'CEA',explain:'Smoking increases'},
  'CA 15-3':{unit:'U/mL',clinical:[0,30],functional:[0,30],category:'other',subcategory:'Tumor Markers',direction:'lower',display:'CA 15-3',explain:'Assay-specific'},
  'CA 19-9':{unit:'U/mL',clinical:[0,37],functional:[0,37],category:'other',subcategory:'Tumor Markers',direction:'lower',display:'CA 19-9',explain:'Lewis antigen negative may read 0'},
  'CA-125':{unit:'U/mL',clinical:[0,35],functional:[0,35],category:'other',subcategory:'Tumor Markers',direction:'lower',display:'CA-125',explain:'Benign conditions can elevate'},
  'Color':{unit:'Clear: 0 Yellow: 1 Dark Yellow: 2 Brown: 3 Orange: 4 Blue : 5 Green: 5 Pink: 6 Red : 6',clinical:[0,2],functional:[0,2],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Color',explain:''},
  'Appearance':{unit:'Clear: 0 Cloudy: 1 Foamy: 2',clinical:[0,0],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Appearance',explain:''},
  'Specific Gravity':{unit:'',clinical:[1.005,1.03],functional:[1.01,1.02],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Specific Gravity',explain:'Hydration dependent'},
  'pH':{unit:'',clinical:[5,8],functional:[6,7],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'pH',explain:''},
  'Nitrites':{unit:'Positive: 1 Negative: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Nitrites',explain:''},
  'Leukocyte esterase / Urinary leucocytes':{unit:'Positive: 1 Negative: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Leukocyte esterase / Urinary leucocytes',explain:''},
  'Protein':{unit:'Positive: 1 Negative: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Protein',explain:'Trace may be benign; quantify with UACR'},
  'Glucose':{unit:'Positive: 1 Negative: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Glucose',explain:''},
  'Ketones':{unit:'Positive: 1 Negative: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Ketones',explain:'Nutritional ketosis may show trace/1+'},
  'Urobilinogen':{unit:'EU/dL',clinical:[0.2,1],functional:[0.2,1],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Urobilinogen',explain:''},
  'Bilirubin':{unit:'Positive: 1 Negative: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Bilirubin',explain:''},
  'Blood':{unit:'Positive: 1 Negative: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Blood',explain:''},
  'Bacteria':{unit:'Present: 1 Absent: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Bacteria',explain:'Culture if symptomatic'},
  'Casts':{unit:'Present: 1 Absent: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Casts',explain:'Type matters (hyaline/waxy/etc.)'},
  'Crystals':{unit:'Many: 2 Few: 1 Absent: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Crystals',explain:'Type matters (oxalate/urate/etc.)'},
  'Epithelial Cells':{unit:'Many: 2 Few: 1 Absent: 0',clinical:[0,1],functional:[0,0],category:'kidney',subcategory:'Urinalysis',direction:'range',display:'Epithelial Cells',explain:'Squamous suggests contamination'},
  'Commensal bacteria (e.g., Lactobacillus, Bifidobacterium)':{unit:'Many: 2 Few: 1 Absent: 0 Overgrowth: 3',clinical:[1,3],functional:[1.7,2.3],category:'other',subcategory:'Microbiome & Gut Health (stool-based)',direction:'range',display:'Commensal bacteria (e.g., Lactobacillus, Bifidobacterium)',explain:'Reported as presence/relative abundance; no universal numeric range'},
  'Opportunistic/pathogenic bacteria (e.g., Clostridium spp., E. coli)':{unit:'Many: 2 Few: 1 Absent: 0 Overgrowth: 3',clinical:[0,2],functional:[0,0],category:'other',subcategory:'Microbiome & Gut Health (stool-based)',direction:'range',display:'Opportunistic/pathogenic bacteria (e.g., Clostridium spp., E. coli)',explain:'Reported as presence/relative abundance; no universal numeric range'},
  'Archaea (e.g., Methanobrevibacter smithii)':{unit:'Many: 2 Few: 1 Absent: 0 Overgrowth: 3',clinical:[0,2],functional:[0,0],category:'other',subcategory:'Microbiome & Gut Health (stool-based)',direction:'range',display:'Archaea (e.g., Methanobrevibacter smithii)',explain:'Reported as presence/relative abundance; no universal numeric range'},
  'Akkermansia muciniphila':{unit:'Many: 2 Few: 1 Absent: 0 Overgrowth: 3',clinical:[1,3],functional:[1.7,2.3],category:'other',subcategory:'Microbiome & Gut Health (stool-based)',direction:'range',display:'Akkermansia muciniphila',explain:'Reported as presence/relative abundance; no universal numeric range'},
  'Mycology / Yeast markers':{unit:'Many: 2 Few: 1 Absent: 0 Overgrowth: 3',clinical:[0,2],functional:[0,0],category:'other',subcategory:'Microbiome & Gut Health (stool-based)',direction:'range',display:'Mycology / Yeast markers',explain:'Reported as presence/relative abundance; no universal numeric range'},
  '% CD3+ (Mature T Cells)':{unit:'%',clinical:[57.85,84.2],functional:[57.85,84.2],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'% CD3+ (Mature T Cells)',explain:''},
  'Absolute CD3+ Cells':{unit:'Cells/uL',clinical:[857,2245],functional:[857,2245],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'Absolute CD3+ Cells',explain:''},
  '% CD4+ (Helper Cells)':{unit:'%',clinical:[33.62,64.83],functional:[33.62,64.83],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'% CD4+ (Helper Cells)',explain:''},
  'Absolute CD4+ Cells':{unit:'Cells/uL',clinical:[518,1472],functional:[518,1472],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'Absolute CD4+ Cells',explain:''},
  '% CD8+ (Suppressor Cells)':{unit:'%',clinical:[13.01,37.57],functional:[13.01,37.57],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'% CD8+ (Suppressor Cells)',explain:''},
  'Absolute CD8+ Cells':{unit:'Cells/uL',clinical:[205,924],functional:[205,924],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'Absolute CD8+ Cells',explain:''},
  '% CD19+ (B Cells)':{unit:'%',clinical:[5.71,24.91],functional:[5.71,24.91],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'% CD19+ (B Cells)',explain:''},
  'Absolute CD19+ Cells':{unit:'Cells/uL',clinical:[87,507],functional:[87,507],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'Absolute CD19+ Cells',explain:''},
  '% CD16+CD56+ (NK Cells)':{unit:'%',clinical:[4.26,26.59],functional:[4.26,26.59],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'% CD16+CD56+ (NK Cells)',explain:''},
  'Absolute CD16+CD56+ Cells':{unit:'Cells/uL',clinical:[74,562],functional:[74,562],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'Absolute CD16+CD56+ Cells',explain:''},
  'CD4:CD8 Ratio':{unit:'Ratio',clinical:[0.9,3.7],functional:[0.9,3.7],category:'inflammation',subcategory:'Immune / Flow Cytometry',direction:'range',display:'CD4:CD8 Ratio',explain:''},
  'EPA (Eicosapentaenoic Acid)':{unit:'% of total fatty acids',clinical:[0.5,3],functional:[1,2.5],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'EPA (Eicosapentaenoic Acid)',explain:'Key anti-inflammatory omega-3 fatty acid'},
  'DHA (Docosahexaenoic Acid)':{unit:'% of total fatty acids',clinical:[2.5,6.5],functional:[3.5,5.5],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'DHA (Docosahexaenoic Acid)',explain:'Critical for brain, hormone, and membrane health'},
  'DPA (Docosapentaenoic Acid)':{unit:'% of total fatty acids',clinical:[0.8,2.5],functional:[0.8,2],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'DPA (Docosapentaenoic Acid)',explain:'Intermediate omega-3; generally beneficial'},
  'Omega-3 Index (EPA + DHA)':{unit:'% of total fatty acids',clinical:[4,12],functional:[8,12],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'Omega-3 Index (EPA + DHA)',explain:'Primary cardiometabolic omega-3 marker'},
  'Total Omega-3':{unit:'% of total fatty acids',clinical:[4,10],functional:[6,10],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'Total Omega-3',explain:'Sum of EPA, DHA, DPA, ALA'},
  'Total Omega-6':{unit:'% of total fatty acids',clinical:[25,45],functional:[30,45],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'Total Omega-6',explain:'High values may reflect pro-inflammatory balance'},
  'Arachidonic Acid (AA)':{unit:'% of total fatty acids',clinical:[8,15],functional:[8,15],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'Arachidonic Acid (AA)',explain:'Omega-6 fatty acid; balance with EPA is key'},
  'Omega-6 : Omega-3 Ratio':{unit:'ratio',clinical:[3,5],functional:[3,5],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'Omega-6 : Omega-3 Ratio',explain:'Lower ratios indicate healthier fatty acid balance'},
  'AA : EPA Ratio':{unit:'ratio',clinical:[5,10],functional:[5,10],category:'metabolic',subcategory:'Fatty Acid Analysis - Omegacheck (Omega 3 & 6)',direction:'range',display:'AA : EPA Ratio',explain:'Inflammation-related omega balance marker'},
  'IGF-1 (Insulin-Like Growth Factor 1)':{unit:'ng/mL',clinical:[70,150],functional:[90,110],category:'other',subcategory:'Other',direction:'range',display:'IGF-1 (Insulin-Like Growth Factor 1)',explain:'Sugar, sleep, dairy, conventional meats can cause an increase - Age-based reference ranges (women) Ages 18-24 Lab range: 108-548 BioWellth target: 200-350 Ages 25-34 Lab range: 99-465 BioWellth target: 180-300 Ages 35-44 Lab range: 79-404 BioWellth target: 150-260 Ages 45-54 Lab range: 60-356 BioWellth target: 120-220 Ages 55-64 Lab range: 41-279 BioWellth target: 90-180 Ages 65+ Lab range: 34-245 BioWellth target: 70-150'},
  'Fibrinogen':{unit:'mg/dL',clinical:[0,400],functional:[0,300],category:'other',subcategory:'Other',direction:'lower',display:'Fibrinogen',explain:'Blood clotting'},
  'Anti-Müllerian Hormone (AMH)':{unit:'ng/mL',clinical:[0.5,5],functional:[1,3.5],category:'other',subcategory:'Other',direction:'range',display:'Anti-Müllerian Hormone (AMH)',explain:'| Age | Typical AMH | - >5 - high PCOS possiblity, <0.5 - very low ovarian reserve | ----- | ----------- | | 20-24 | 3.0 - 6.5 | | 25-29 | 2.5 - 5.5 | | 30-34 | 1.5 - 4.0 | | 35-39 | 1.0 - 3.0 | | 40-44 | 0.5 - 1.5 | | 45+ | < 1.0 |'},
  'Estradiol':{unit:'pg/mL',clinical:[60,250],functional:[100,200],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Estradiol',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Progesterone':{unit:'ng/mL',clinical:[0.3,20],functional:[10,20],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Progesterone',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Testosterone (Total)':{unit:'ng/dL',clinical:[15,45],functional:[20,30],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Testosterone (Total)',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.',aliases:['Testosterone','Total Testosterone','TT']},
  'Testosterone (Free)':{unit:'pg/mL',clinical:[0.5,8.5],functional:[2,6],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Testosterone (Free)',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.',aliases:['Free Testosterone','FT']},
  'SHBG':{unit:'nmol/L',clinical:[30,120],functional:[40,80],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'SHBG',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'FSH':{unit:'mIU/mL',clinical:[1,10],functional:[1,9],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'FSH',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'LH':{unit:'mIU/mL',clinical:[1,14],functional:[1,14],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'LH',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Prolactin':{unit:'ng/mL',clinical:[5,20],functional:[5,15],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Prolactin',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'AMH':{unit:'ng/mL',clinical:[1,5],functional:[1.5,4],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'AMH',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Ultra-sensitive Estradiol':{unit:'pg/mL',clinical:[20,400],functional:[80,200],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Ultra-sensitive Estradiol',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Testosterone, Bioavailable':{unit:'ng/dL',clinical:[1.5,8.5],functional:[2,6],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Testosterone, Bioavailable',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Estriol (E3)':{unit:'ng/mL',clinical:[0,0.1],functional:[0.02,0.04],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Estriol (E3)',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Estrone (E1)':{unit:'pg/mL',clinical:[17,200],functional:[60,120],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Estrone (E1)',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Pregnenolone':{unit:'ng/dL',clinical:[2.5,75],functional:[30,60],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Pregnenolone',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
  'Dihydrotestosterone (DHT)':{unit:'ng/dL',clinical:[0,30],functional:[5,15],category:'hormones',subcategory:'Adrenal & Steroid Hormones',direction:'range',display:'Dihydrotestosterone (DHT)',explain:'Hormone ranges vary by cycle phase. This is a general target; actual interpretation should consider where you are in your cycle.'},
};

function findRangeFor(name) {
  if (FUNCTIONAL_RANGES[name]) return { key: name, def: FUNCTIONAL_RANGES[name] };
  // Try case-insensitive match
  const lower = name.toLowerCase().trim();
  for (const k of Object.keys(FUNCTIONAL_RANGES)) {
    if (k.toLowerCase() === lower) return { key: k, def: FUNCTIONAL_RANGES[k] };
  }
  // Try alias matching
  for (const k of Object.keys(FUNCTIONAL_RANGES)) {
    const def = FUNCTIONAL_RANGES[k];
    if (def.aliases) {
      for (const a of def.aliases) {
        if (a.toLowerCase() === lower) return { key: a, def: FUNCTIONAL_RANGES[a] || def };
      }
    }
  }
  return null;
}

function classifyMarker(value, def) {
  const direction = def.direction || 'range';
  const [fLow, fHigh] = def.functional;
  const [cLow, cHigh] = def.clinical;

  // How far past a clinical boundary still reads as "mildly out" (monitor)
  // rather than genuinely concerning (low/high). One knob, tune freely.
  const MONITOR_FRACTION = 0.15;

  if (direction === 'lower') {
    if (value > cHigh) {
      const buffer = Math.abs(cHigh) * MONITOR_FRACTION;
      return (value - cHigh) <= buffer ? 'monitor' : 'high';
    }
    if (value > fHigh) {
      const watchBuffer = ((fHigh - fLow) || 1) * 0.4;
      return (value - fHigh) > watchBuffer ? 'suboptimal' : 'watch';
    }
    return 'ok';
  }

  if (direction === 'higher') {
    if (value < cLow) {
      const buffer = Math.abs(cLow) * MONITOR_FRACTION;
      return (cLow - value) <= buffer ? 'monitor' : 'low';
    }
    if (value < fLow) {
      const watchBuffer = ((fHigh - fLow) || 1) * 0.4;
      return (fLow - value) > watchBuffer ? 'suboptimal' : 'watch';
    }
    return 'ok';
  }

  const clinicalSpan = (cHigh - cLow) || Math.abs(cHigh) || 1;
  const monitorBuffer = clinicalSpan * MONITOR_FRACTION;

  if (value < cLow) {
    return (cLow - value) <= monitorBuffer ? 'monitor' : 'low';
  }
  if (value > cHigh) {
    return (value - cHigh) <= monitorBuffer ? 'monitor' : 'high';
  }
  const funcSpan = (fHigh - fLow) || 1;
  const watchBuffer = funcSpan * 0.4;
  if (value < fLow) return (fLow - value) > watchBuffer ? 'suboptimal' : 'watch';
  if (value > fHigh) return (value - fHigh) > watchBuffer ? 'suboptimal' : 'watch';
  return 'ok';
}

function buildEnriched(rawMarkers) {
  const enriched = [];
  for (const m of rawMarkers) {
    if (typeof m.value !== 'number' || isNaN(m.value)) continue;
    const found = findRangeFor(m.name);
    if (!found) continue; // skip markers we don't have ranges for
    const def = found.def;
    const status = classifyMarker(m.value, def);
    enriched.push({
      name: found.key,
      displayName: def.display || found.key,
      value: m.value,
      unit: m.unit || def.unit,
      category: def.category,
      subcategory: def.subcategory || 'Other',
      direction: def.direction || 'range',
      clinical: def.clinical,
      functional: def.functional,
      status,
      explain: def.explain,
    });
  }
  return enriched;
}

function calculateScore(enriched) {
  if (enriched.length === 0) return 0;
  const w = { ok: 1.0, watch: 0.6, suboptimal: 0.5, monitor: 0.45, low: 0.25, high: 0.25 };
  let total = 0;
  for (const m of enriched) total += (w[m.status] ?? 0.5);
  // Cap at how many were possible to test from the full database
  const possible = Object.keys(FUNCTIONAL_RANGES).length;
  // Score: marker quality (out of tested) blended with coverage
  const quality = total / enriched.length;
  const coverage = Math.min(1, enriched.length / 25); // 25+ markers = full coverage
  const score = quality * 0.7 + coverage * 0.3;
  return Math.round(score * 100);
}

function scoreToBand(score) {
  if (score < 50) return "Building";
  if (score < 75) return "Steady";
  return "Thriving";
}

function getSystemStatus(markers) {
  if (!markers || markers.length === 0) return 'untested';
  if (markers.some(m => m.status === 'low' || m.status === 'high')) return 'low';
  if (markers.some(m => m.status === 'monitor' || m.status === 'suboptimal')) return 'monitor';
  if (markers.some(m => m.status === 'watch')) return 'watch';
  return 'ok';
}
