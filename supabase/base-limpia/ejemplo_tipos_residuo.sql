-- ============================================================
-- GestionLab — catálogo de EJEMPLO de tipos de residuo (OPCIONAL)
-- ============================================================
-- Generado por tools/base-limpia/sacar_base_limpia.py --ejemplo-residuos.
-- ⚠ NO EDITAR A MANO. Ver supabase/base-limpia/README.md.
--
-- 113 residuos de laboratorio con su nombre y su riesgo (pictogramas GHS), como punto
-- de partida. NO lleva a qué contenedor va cada uno: eso lo deciden las normas del
-- gestor de residuos de cada centro, y se asigna después en la app (Guía de residuos →
-- editar cada tipo). Mientras no se asigne, la guía los agrupa en «Sin contenedor
-- asignado». Las descripciones que hablaban de contenedores o normas de un centro
-- concreto van vacías (30).
--
-- Se aplica DESPUÉS de la migración base, en el editor SQL. Se puede repetir: no pisa
-- lo que ya exista.
-- ============================================================

BEGIN;

INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R001', 'Parafina con restos de X-Free', NULL, 'Inflamable, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R002', 'Gel de agarosa post-electroforesis', 'Gel de agarosa solidificado con buffer de carga y colorante intercalante (GelSafe/GelRed) tras electroforesis', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R003', 'Frotis teñidos con HE', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R004', 'Frotis teñidos con Papanicolaou', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R005', 'Frotis teñidos con May-Grünwald/Giemsa', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R006', 'Frotis teñidos con Diff-Quick', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R007', 'Portas con tinción de panóptico', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R008', 'Frotis con azul de lactofenol', NULL, 'Tóxico, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R010', 'Envases de vidrio vacíos que contuvieron productos químicos', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R011', 'Tejidos fijados en formol', NULL, 'Tóxico, Cancerígeno / CMR, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R012', 'Tejidos incluidos en parafina', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R013', 'Secciones histológicas con tejido (HE)', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R014', 'Material con azul tripán (Neubauer)', NULL, 'Tóxico, Cancerígeno / CMR')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R015', 'Etanol (cualquier graduación)', 'Etanol residual de procedimientos histológicos o microbiológicos; distintas graduaciones', 'Inflamable')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R016', 'X-Free solo o con restos de etanol', 'Sustituto de xileno residual procedente de aclaramiento histológico; puede contener etanol', 'Inflamable, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R017', 'Etanol con restos de colorantes', 'Etanol de enjuagues o diferenciación con colorantes disueltos', 'Inflamable')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R018', 'May-Grünwald/Giemsa residuo líquido', 'Colorante residual líquido en base metanol; tóxico por metanol', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R019', 'Diff-Quick fracción metanólica', 'Fracción metanólica residual del colorante Diff-Quick', 'Tóxico, Inflamable')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R020', 'Colorantes del Papanicolaou (fracciones etanólicas)', 'Residuos líquidos de OG-6 y EA en etanol del protocolo de Papanicolaou', 'Inflamable, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R021', 'Eosina en etanol', 'Solución residual de eosina en etanol procedente de tinción HE', 'Inflamable, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R023', 'Azul de lactofenol líquido', 'Solución residual de azul de lactofenol; contiene fenol (tóxico y corrosivo); frasco propio y bien etiquetado', 'Tóxico, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R024', 'Glicerol residual', 'Glicerol procedente de soluciones de preservación o stocks; baja toxicidad', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R025', 'Aceite de inmersión', 'Aceite de inmersión residual para microscopía; aceite mineral o sintético no halogenado', 'Peligroso para el medio ambiente')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R026', 'Medios de cultivo con DMSO', 'Medios de cultivo celular con concentraciones apreciables de DMSO (>1%); no halogenado', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R027', 'Medio de congelación FBS + DMSO', 'Mezcla de suero fetal bovino y DMSO usada en criopreservación celular; DMSO no halogenado', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R028', 'Etanol:Éter', 'Mezcla de etanol y éter etílico; EXTREMADAMENTE INFLAMABLE (punto de inflamación éter -45°C); frasco pequeño sellado y gestión prioritaria', 'Inflamable, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R029', 'Transparentador de tiras de acetato de celulosa', 'Disolvente de aclaramiento de tiras de electroforesis de acetato; generalmente no halogenado (verificar composición del producto específico)', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R030', 'Hematoxilina de Mayer', 'Solución residual de hematoxilina acidificada con ácido cítrico', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R031', 'Rojo de Ponceau', 'Solución residual de rojo de Ponceau en ácido acético; usada en electroforesis de proteínas', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R032', 'Ácido bórico (solución)', 'Soluciones acuosas residuales de ácido bórico', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R033', 'Ácidos diluidos varios', 'Soluciones residuales de ácidos diluidos (distintas procedencias y concentraciones)', 'Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R034', 'NaOH residual', 'Soluciones residuales de hidróxido sódico', 'Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R035', 'Bases diluidas varias', 'Soluciones residuales de bases diluidas (distintas procedencias)', 'Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R036', 'Agua con restos de formol', NULL, 'Tóxico, Cancerígeno / CMR, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R037', 'Permanganato potásico', 'Solución residual de permanganato potásico; oxidante fuerte; NUNCA mezclar con orgánicos; frasco propio etiquetado como oxidante inorgánico', 'Comburente, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R038', 'Buffer TAE', 'Buffer Tris-Acetato-EDTA residual de electroforesis en gel de agarosa; acuoso y muy diluido', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R039', 'Buffers de electroforesis varios', 'Buffers acuosos residuales de electroforesis (distintos tipos); muy diluidos', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R040', 'Azul de toluidina acuoso diluido', 'Solución acuosa muy diluida de azul de toluidina residual de enjuagues', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R041', 'Azul de bromofenol acuoso diluido', 'Solución acuosa muy diluida de azul de bromofenol residual de enjuagues o indicador de pH', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R042', 'Colorantes acuosos diluidos (enjuagues varios)', 'Aguas de enjuague con trazas de colorantes acuosos (gram acuosos etc.); muy diluidos. Incluye el líquido completo del cristalizador de la tinción de Gram (colorante + decolorante de etanol + safranina, todo junto tal como se genera en la práctica), no solo la fracción acuosa.', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R043', 'Medios de cultivo sin DMSO o con DMSO < 1%', 'Medios de cultivo celular con concentración de DMSO inferior al 1% o sin DMSO; acuosos', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R044', 'Lejía diluida (desinfección)', NULL, 'Corrosivo, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R045', 'SYBR Green residual', 'Residuo líquido de mezclas de qPCR con SYBR Green (intercalante de DNA); potencialmente mutagénico; no mezclar con otros residuos', 'Tóxico, Cancerígeno / CMR')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R046', 'Mezcla de PCR sin fluorocromo (residuo acuoso)', 'Residuo acuoso de reacciones de PCR sin colorante intercalante; contiene tampón Taq + dNTPs + MgCl2 a concentraciones mínimas', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R047', 'TRIzol o reactivos fenólicos de extracción RNA/DNA', 'Reactivos de extracción de ácidos nucleicos con fenol y tiocianato de guanidinio (TRIzol y equivalentes); muy tóxico y corrosivo', 'Tóxico, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R048', 'Cloroformo para extracción de ácidos nucleicos', 'Cloroformo o mezcla fenol-cloroformo-isoamílico residual de extracción de RNA/DNA; disolvente halogenado hepatotóxico', 'Tóxico, Cancerígeno / CMR')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R049', 'Isopropanol para precipitación de ácidos nucleicos', 'Isopropanol residual de pasos de precipitación de DNA/RNA; inflamable', 'Inflamable, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R050', 'Gel de poliacrilamida post-electroforesis (PAGE/SDS-PAGE)', 'Geles de poliacrilamida usados; la acrilamida residual no polimerizada es neurotóxica y probable carcinógeno; riesgo mayor que agarosa', 'Tóxico, Cancerígeno / CMR')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R051', 'Solución de Coomassie Blue (tinción de proteínas)', 'Solución de azul de Coomassie en metanol + ácido acético para tinción de geles de proteínas', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R052', 'Solución de desteñido de Coomassie (destaining)', 'Solución de metanol + ácido acético usada para desteñir geles tras tinción con Coomassie; contiene colorante en disolución', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R053', 'β-mercaptoetanol residual', 'β-mercaptoetanol puro o en solución (tampones de lisis con SDS; solución de stripping); muy tóxico y con olor penetrante; gestión urgente y en campana', 'Tóxico, Inflamable')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R054', 'Solución de stripping para Western blot', 'Solución de regeneración de membranas con β-mercaptoetanol + SDS en tampón; tóxico y volátil', 'Tóxico, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R055', 'OCT compound (Tissue-Tek o similar)', 'Medio de inclusión para criostato a base de polietilenglicol y alcohol polivinílico; baja toxicidad; miscible con agua', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R056', 'Cuchillas de microtomo usadas', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R057', 'Cuchillas del criostato usadas', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R058', 'Reactivo de Schiff (para PAS)', 'Fucsina básica decolorada con metabisulfito sódico en HCl; la fucsina puede regenerarse en forma activa; reactivo acidificado', 'Tóxico, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R059', 'Ácido peryódico (PAS)', 'Solución oxidante de ácido peryódico para oxidación de polisacáridos; oxidante fuerte inorgánico; frasco propio', 'Corrosivo, Comburente')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R060', 'Solución de Bouin', 'Fijador histológico a base de ácido pícrico + formaldehído + ácido acético glacial; EXTREMADAMENTE PELIGROSO: el ácido pícrico seco es explosivo; nunca dejar evaporar; frasco propio y consulta urgente con Consenur', 'Tóxico, Cancerígeno / CMR, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R061', 'Solución de Carnoy', 'Fijador histológico a base de etanol + cloroformo + ácido acético glacial; contiene cloroformo (halogenado hepatotóxico)', 'Tóxico, Cancerígeno / CMR, Inflamable')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R062', 'DAB (3-3''-diaminobencidina) para inmunohistoquímica', 'Cromógeno para detección de peroxidasa en IHQ; sospechoso de ser carcinógeno (IARC 2B); nunca verter por desagüe', 'Tóxico, Cancerígeno / CMR')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R063', 'Glutaraldehído residual', 'Fijador de tejidos para microscopía electrónica o fijación especial; tóxico irritante de mucosas y vías respiratorias; frasco propio bien sellado', 'Tóxico, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R064', 'Cola de montaje DPX o Entellan', 'Medio de montaje de cubreobjetos con tolueno o xileno como disolvente; si se usa X-Free como alternativa ya está cubierto; verificar disolvente del producto usado', 'Tóxico, Inflamable')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R065', 'Reactivo de Perls (tinción del hierro)', 'Mezcla de ferrocianuro potásico + HCl para demostración de hierro en tejidos; genera azul de Prusia; residuo acidificado con ferrocianuro', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R066', 'Carbol-fucsina de Ziehl-Neelsen', 'Solución de fucsina básica en fenol-etanol para tinción de micobacterias; contiene fenol libre en concentración significativa', 'Tóxico, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R067', 'Alcohol ácido de Ziehl-Neelsen (decolorante)', 'Mezcla de HCl + etanol para decoloración en Ziehl-Neelsen; fracción ácida', 'Inflamable, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R068', 'TMB (sustrato de ELISA)', 'Solución de 3''3''5''5''-tetrametilbencidina para revelado de ELISA; potencialmente mutagénico; frasco separado', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R069', 'Solución de parada de ELISA (H2SO4 o HCl)', 'Ácido sulfúrico o clorhídrico diluido usado para detener la reacción colorimétrica de ELISA; acidificado con TMB oxidado en solución', 'Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R070', 'Solución de lavado de ELISA (PBS-Tween)', 'Tampón fosfato salino con Tween 20 usado en pasos de lavado del ELISA; acuoso y muy diluido', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R071', 'Reactivos de quimioluminiscencia (Maglumi 600)', 'Reactivos del analizador de quimioluminiscencia Snibe Maglumi; contienen luminol u otros sustratos luminiscentes + H2O2 + tampones + conservantes; consultar fichas del fabricante', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R072', 'Antisueros y reactivos líquidos del sistema Ortho (inmunohematología)', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R073', 'Reactivos de coagulometría (tromboplastina y tampones)', 'Reactivos de los coagulómetros RAL y bio-bas; tromboplastina recombinante o tisular + soluciones de CaCl2 + plasma; residuo biológico/químico mixto', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R074', 'Azida sódica (conservante de reactivos y anticuerpos)', 'Azida sódica presente en anticuerpos comerciales y reactivos de autoanalizador; extremadamente tóxico y forma azidas metálicas explosivas en tuberías metálicas; NUNCA verter por el desagüe; frasco propio', 'Tóxico')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R075', 'Lisante de eritrocitos del citómetro (Celltac MEK-6500K)', 'Reactivo de lisis de hematíes para recuento de leucocitos en citómetro; contiene formaldehído o amonio cuaternario + detergentes según fabricante; consultar MSDS del producto', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R076', 'Solución de limpieza del citómetro y autoanalizadores', 'Soluciones de mantenimiento y limpieza de los autoanalizadores y citómetro; suelen contener hipoclorito diluido + detergentes; acuosas', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R077', 'Medios de cultivo sólidos con crecimiento (pre-esterilización)', 'Placas o tubos de agar con colonias bacterianas; AUTOCLAVE PREVIO OBLIGATORIO antes de eliminar; biológicamente inactivado tras ciclo validado', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R078', 'Medios de cultivo sólidos esterilizados (post-autoclave)', 'Medios de agar con colonias tras ciclo de autoclavado validado (121°C 20 min); inactivados biológicamente; pueden ir a residuo ordinario si el autoclave está validado y hay registro del ciclo', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R079', 'Medios de cultivo líquidos con crecimiento bacteriano', 'Caldos bacteriológicos con crecimiento; AUTOCLAVE PREVIO OBLIGATORIO; biológicamente inactivado tras ciclo validado', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R080', 'Lugol (solución yodo-yoduro potásico)', 'Solución de lugol residual de tinción de Gram o identificación bacteriana; yodo inorgánico; no es halogenado orgánico', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R081', 'Agua oxigenada (H2O2) al 3% o 30%', 'Peróxido de hidrógeno residual de pruebas de catalasa o bloqueo de peroxidasa endógena en IHQ; oxidante fuerte; frasco propio separado de orgánicos', 'Comburente, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R082', 'Reactivo de la oxidasa', 'Solución de dimetil-p-fenilendiamina o tetrametil-p-fenilendiamina para prueba de la oxidasa bacteriana; tóxico; en tiras o solución', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R083', 'Discos de antibiograma usados', 'Discos de papel impregnados con antibióticos tras antibiograma en placa de agar; AUTOCLAVE PREVIO; β-lactámicos y aminoglucósidos se inactivan en autoclave', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R084', 'Reactivos del destilador Kjeldahl (H2SO4 concentrado)', 'Ácido sulfúrico concentrado residual de digestión Kjeldahl; muy corrosivo; frasco propio etiquetado como ácido concentrado', 'Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R085', 'Reactivos del destilador Kjeldahl (NaOH concentrado + catalizadores)', 'NaOH concentrado residual de etapa de destilación Kjeldahl + posibles catalizadores de selenio o mercurio; si contiene mercurio es residuo de metal pesado y requiere gestión específica', 'Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R086', 'Destilado Kjeldahl con ácido bórico e indicadores', 'Líquido destilado recogido en ácido bórico con indicadores mixtos para valoración de nitrógeno; acuoso con trazas de indicadores', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R087', 'Reactivos bioquímicos de autoanalizador (Metrolab 2300)', 'Reactivos de bioquímica clínica (glucosa oxidasa; colesterol esterasa/oxidasa/peroxidasa 4-AAP; triglicéridos etc.); contienen cromógenos y conservantes variables; consultar MSDS de cada kit', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R089', 'Muestras biológicas residuales (suero plasma orina)', 'Restos de suero plasma orina y otras muestras clínicas tras análisis; AUTOCLAVE PREVIO; biológicamente inactivado tras ciclo validado; tubos incluidos', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R090', 'Material fungible contaminado con muestras biológicas', 'Puntas de pipeta tubos Eppendorf y Falcon gasas e hisopos en contacto con muestras biológicas; AUTOCLAVE PREVIO; biológicamente inactivado tras ciclo validado', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R091', 'Material punzante (agujas lancetas sistemas de vacío)', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R092', 'Hojas de bisturí usadas', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R093', 'Calibradores y controles de autoanalizadores', NULL, 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R094', 'Soluciones de desenmascaramiento antigénico (IHQ)', 'Tampón citrato pH 6 o EDTA pH 9 para recuperación antigénica en inmunohistoquímica; acuosas con baja toxicidad', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R095', 'Medios de montaje para inmunofluorescencia (Vectashield Mowiol)', 'Medios de montaje antifade con glicerol + DABCO o similar para preservar fluorescencia; contienen DABCO (1-4-diazabiciclo[2.2.2]octano); moderadamente tóxico', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R096', 'Fluorocromos libres residuales (FITC PE DAPI)', 'Soluciones residuales de fluorocromos para inmunofluorescencia o citometría de flujo; DAPI es potencialmente mutagénico; concentraciones típicamente bajas pero no deben ir al desagüe', 'Tóxico, Cancerígeno / CMR')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R097', 'Solución de hematoxilina de Weigert o hematoxilina férrica', 'Soluciones de hematoxilina preparadas con hierro (Weigert) o sulfato de aluminio y potasio (Ehrlich Harris); distintas de la hematoxilina de Mayer del R030', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R098', 'Reactivos de tinción de Masson (tricrómico)', 'Reactivos del tricrómico de Masson: fucsina ácida + azul de anilina/verde luz + ácido fosfotúngstico/fosfomolíbdico; fraccionados en ácidos y no ácidos', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R099', 'Solución de osmio (tetróxido de osmio OsO4)', 'Fijador y agente de contraste para microscopía electrónica; EXTREMADAMENTE TÓXICO Y VOLÁTIL; si existe en el centro requiere gestión urgente específica', 'Tóxico, Peligroso para el medio ambiente')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R100', 'Residuos de soluciones tampón del osmómetro (calibración)', 'Soluciones osmóticas de calibración del osmómetro Gonotec; acuosas; baja toxicidad', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R101', 'Reactivos de látex para aglutinación', 'Suspensiones de látex sensibilizadas con antígenos o anticuerpos para pruebas de aglutinación; acuosas con baja concentración de reactivos', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R102', 'Agua de enjuague del homogenizador Stomacher', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R103', 'Solución de yoduro de propidio (PI) para viabilidad celular', NULL, 'Tóxico, Cancerígeno / CMR')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R104', 'Solución de Giemsa acuosa (parasitología)', 'Solución de trabajo acuosa de Giemsa para tinción de parásitos en sangre; base metanol pero muy diluida en agua para uso', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R105', 'Reactivos de identificación bioquímica bacteriana (galerías API tiras IMViC)', 'Residuos de pruebas de identificación bioquímica bacteriana; contienen sustratos variados con compuestos orgánicos específicos para cada galería', 'Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R106', 'Hipoclorito sódico concentrado (para desinfección de cultivos)', 'Lejía concentrada (>5%) usada para descontaminación de material biológico antes de autoclave o como desinfectante de cultivos derramados; oxidante corrosivo', 'Corrosivo, Nocivo / Irritante')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R107', 'Ropa de protección contaminada con muestras biológicas', 'Batas guantes EPI contaminados con sangre u otras muestras clínicas; no autoclavable de forma práctica; RESIDUO BIOLÓGICO GRUPO II', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R108', 'Reactivos de fijación para citometría de flujo (formaldehído diluido)', NULL, 'Tóxico, Cancerígeno / CMR, Corrosivo')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R109', 'Preparación histológica completa (tejido fijado + incluido + teñido HE + montado DPX)', NULL, 'Tóxico, Cancerígeno / CMR, Inflamable')
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R110', 'Placa de ELISA usada', 'Microplaca de 96 pocillos tras revelado de ELISA con lavador automático; contiene restos de muestra biológica (suero/plasma) + anticuerpos + trazas de TMB oxidado + solución de parada ácida adsorbidos en plástico. Residuo sólido compuesto no separable. AUTOCLAVE PREVIO por contaminación biológica.', NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R111', 'Efluente del lavador de microplacas (ELISA)', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R112', 'Tarjetas de gel de inmunohematología usadas', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('R113', 'Calibradores de pHmetro (tampones de calibración usados)', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('RES8HHJ8P', 'Envases vacíos metálicos (aluminio) que contuvieron sustancias peligrosas', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('RESBVQHGW', 'Guantes, papel, filtros y absorbentes manchados con sustancias peligrosas', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;
INSERT INTO public.tipos_residuo (id_residuo, nombre, descripcion, riesgo) VALUES ('RESNLOFGQ', 'Envases vacíos de plástico que contuvieron sustancias peligrosas', NULL, NULL)
  ON CONFLICT (id_residuo) DO NOTHING;

COMMIT;
