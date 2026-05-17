-- ============================================================================
-- 6 classic public recipes seeded by admin (owner_id = NULL, visibility =
-- 'public'). Each block is idempotent: skips if a public recipe with the
-- same title already exists. Ingredients link to the catalogue via name
-- lookups so re-seeds keep working even if catalogue uuids differ.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PÂTES BOLOGNAISE
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.recipe
    where recipe_title = 'Pâtes bolognaise'
      and recipe_visibility = 'public'
      and recipe_owner_id is null
  ) then
    insert into public.recipe (
      recipe_visibility, recipe_owner_id, recipe_title, recipe_description,
      recipe_time_prep_minutes, recipe_time_cook_minutes, recipe_time_rest_minutes,
      recipe_calories, recipe_servings
    ) values (
      'public', null, 'Pâtes bolognaise',
      'Le classique italien revisité à la française : une sauce mijotée à la viande hachée, oignon, carotte, céleri et tomate. À servir sur des spaghetti avec du parmesan râpé.',
      20, 90, null, 650, 4
    ) returning recipe_id into v_id;

    insert into public.recipe_ingredient (
      recipe_ingredient_recipe_id, recipe_ingredient_catalog_id,
      recipe_ingredient_quantity, recipe_ingredient_unit, recipe_ingredient_position
    )
    select v_id,
           (select ingredient_id from public.ingredient where ingredient_name = q.name),
           q.qty, q.unit::public.meal_unit, q.pos
    from (values
      ('Spaghetti',            400::numeric, 'g',     0),
      ('Bœuf haché',           400::numeric, 'g',     1),
      ('Oignon jaune',           1::numeric, 'piece', 2),
      ('Carotte',              200::numeric, 'g',     3),
      ('Céleri branche',         1::numeric, 'botte', 4),
      ('Ail',                    2::numeric, 'gousse',5),
      ('Tomates concassées',   400::numeric, 'g',     6),
      ('Concentré de tomate',   30::numeric, 'g',     7),
      ('Vin rouge',            100::numeric, 'ml',    8),
      ('Huile d''olive',        30::numeric, 'ml',    9),
      ('Herbes de Provence',     5::numeric, 'g',    10),
      ('Sel',                    5::numeric, 'g',    11),
      ('Poivre noir',            2::numeric, 'g',    12),
      ('Parmesan',              50::numeric, 'g',    13)
    ) as q(name, qty, unit, pos);

    insert into public.recipe_step (
      recipe_step_recipe_id, recipe_step_position, recipe_step_text
    ) values
      (v_id, 0, 'Émincez l''oignon et l''ail. Coupez les carottes et le céleri en petits dés.'),
      (v_id, 1, 'Faites chauffer l''huile d''olive dans une grande sauteuse. Faites revenir l''oignon 3 min, puis ajoutez l''ail, les carottes et le céleri. Laissez cuire 5 min.'),
      (v_id, 2, 'Ajoutez la viande hachée. Faites-la dorer en l''émiettant à la spatule, 5 à 7 min.'),
      (v_id, 3, 'Versez le vin rouge, grattez le fond avec une spatule pour décoller les sucs. Laissez réduire de moitié.'),
      (v_id, 4, 'Ajoutez les tomates concassées, le concentré de tomate, les herbes de Provence, le sel et le poivre. Couvrez et laissez mijoter à feu doux 1h à 1h15 en remuant de temps en temps.'),
      (v_id, 5, 'Faites cuire les spaghetti dans une grande casserole d''eau bouillante salée selon le temps indiqué sur le paquet.'),
      (v_id, 6, 'Égouttez les pâtes, servez-les nappées de sauce bolognaise et parsemez de parmesan râpé.');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. PÂTES CARBONARA
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.recipe
    where recipe_title = 'Pâtes carbonara'
      and recipe_visibility = 'public'
      and recipe_owner_id is null
  ) then
    insert into public.recipe (
      recipe_visibility, recipe_owner_id, recipe_title, recipe_description,
      recipe_time_prep_minutes, recipe_time_cook_minutes, recipe_time_rest_minutes,
      recipe_calories, recipe_servings
    ) values (
      'public', null, 'Pâtes carbonara',
      'La vraie carbonara romaine : ni crème ni oignon. Juste jaune d''œuf, parmesan, lardons et beaucoup de poivre noir. Le secret tient à la chaleur résiduelle des pâtes qui lie la sauce sans cuire l''œuf.',
      10, 15, null, 700, 4
    ) returning recipe_id into v_id;

    insert into public.recipe_ingredient (
      recipe_ingredient_recipe_id, recipe_ingredient_catalog_id,
      recipe_ingredient_quantity, recipe_ingredient_unit, recipe_ingredient_position
    )
    select v_id,
           (select ingredient_id from public.ingredient where ingredient_name = q.name),
           q.qty, q.unit::public.meal_unit, q.pos
    from (values
      ('Spaghetti',    400::numeric, 'g',     0),
      ('Lardons',      200::numeric, 'g',     1),
      ('Œuf',            4::numeric, 'piece', 2),
      ('Parmesan',     100::numeric, 'g',     3),
      ('Poivre noir',    3::numeric, 'g',     4),
      ('Sel',            5::numeric, 'g',     5)
    ) as q(name, qty, unit, pos);

    insert into public.recipe_step (
      recipe_step_recipe_id, recipe_step_position, recipe_step_text
    ) values
      (v_id, 0, 'Faites cuire les spaghetti dans une grande casserole d''eau bouillante salée.'),
      (v_id, 1, 'Dans une poêle, faites revenir les lardons sans matière grasse jusqu''à ce qu''ils soient bien dorés.'),
      (v_id, 2, 'Dans un bol, séparez les jaunes des blancs. Battez les jaunes avec le parmesan râpé et beaucoup de poivre noir.'),
      (v_id, 3, 'Égouttez les pâtes en gardant une louche d''eau de cuisson. Mélangez les pâtes encore chaudes aux lardons, hors du feu.'),
      (v_id, 4, 'Versez immédiatement le mélange jaunes-fromage sur les pâtes en mélangeant vite. Ajoutez un peu d''eau de cuisson pour rendre la sauce crémeuse. Servez aussitôt.');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. POULET BASQUAISE
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.recipe
    where recipe_title = 'Poulet basquaise'
      and recipe_visibility = 'public'
      and recipe_owner_id is null
  ) then
    insert into public.recipe (
      recipe_visibility, recipe_owner_id, recipe_title, recipe_description,
      recipe_time_prep_minutes, recipe_time_cook_minutes, recipe_time_rest_minutes,
      recipe_calories, recipe_servings
    ) values (
      'public', null, 'Poulet basquaise',
      'Plat traditionnel du Pays basque : cuisses de poulet mijotées avec poivrons, tomates, oignon, ail et piment d''Espelette. À servir avec du riz blanc.',
      20, 45, null, 480, 4
    ) returning recipe_id into v_id;

    insert into public.recipe_ingredient (
      recipe_ingredient_recipe_id, recipe_ingredient_catalog_id,
      recipe_ingredient_quantity, recipe_ingredient_unit, recipe_ingredient_position
    )
    select v_id,
           (select ingredient_id from public.ingredient where ingredient_name = q.name),
           q.qty, q.unit::public.meal_unit, q.pos
    from (values
      ('Cuisse de poulet',     4::numeric, 'piece',  0),
      ('Poivron rouge',        2::numeric, 'piece',  1),
      ('Poivron vert',         2::numeric, 'piece',  2),
      ('Oignon jaune',         1::numeric, 'piece',  3),
      ('Ail',                  3::numeric, 'gousse', 4),
      ('Tomate',               4::numeric, 'piece',  5),
      ('Piment d''Espelette',  5::numeric, 'g',      6),
      ('Huile d''olive',      30::numeric, 'ml',     7),
      ('Vin blanc',          150::numeric, 'ml',     8),
      ('Thym',                 1::numeric, 'botte',  9),
      ('Laurier',              2::numeric, 'piece', 10),
      ('Sel',                  5::numeric, 'g',     11),
      ('Poivre noir',          2::numeric, 'g',     12)
    ) as q(name, qty, unit, pos);

    insert into public.recipe_step (
      recipe_step_recipe_id, recipe_step_position, recipe_step_text
    ) values
      (v_id, 0, 'Salez et poivrez les cuisses de poulet sur les deux faces. Dans une cocotte, faites chauffer l''huile d''olive et faites-y dorer les cuisses sur toutes les faces. Réservez.'),
      (v_id, 1, 'Émincez l''oignon, l''ail et coupez les poivrons en lanières. Dans la même cocotte, faites revenir l''oignon 3 min, puis ajoutez l''ail et les poivrons. Laissez cuire 8 min.'),
      (v_id, 2, 'Coupez les tomates en quartiers et ajoutez-les avec le piment d''Espelette, le thym et le laurier. Mélangez.'),
      (v_id, 3, 'Remettez les cuisses de poulet, versez le vin blanc, salez, poivrez. Couvrez et laissez mijoter à feu doux 35 à 40 min.'),
      (v_id, 4, 'Servez avec du riz blanc.');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. BŒUF BOURGUIGNON
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.recipe
    where recipe_title = 'Bœuf bourguignon'
      and recipe_visibility = 'public'
      and recipe_owner_id is null
  ) then
    insert into public.recipe (
      recipe_visibility, recipe_owner_id, recipe_title, recipe_description,
      recipe_time_prep_minutes, recipe_time_cook_minutes, recipe_time_rest_minutes,
      recipe_calories, recipe_servings
    ) values (
      'public', null, 'Bœuf bourguignon',
      'Le grand classique français : bœuf braisé au vin rouge, lardons, oignons, carottes et champignons. Encore meilleur réchauffé le lendemain. À servir avec des pommes de terre vapeur ou des tagliatelles fraîches.',
      30, 180, null, 620, 6
    ) returning recipe_id into v_id;

    insert into public.recipe_ingredient (
      recipe_ingredient_recipe_id, recipe_ingredient_catalog_id,
      recipe_ingredient_quantity, recipe_ingredient_unit, recipe_ingredient_position
    )
    select v_id,
           (select ingredient_id from public.ingredient where ingredient_name = q.name),
           q.qty, q.unit::public.meal_unit, q.pos
    from (values
      ('Paleron de bœuf',      1200::numeric, 'g',     0),
      ('Lardons',               200::numeric, 'g',     1),
      ('Carotte',               300::numeric, 'g',     2),
      ('Oignon jaune',            2::numeric, 'piece', 3),
      ('Ail',                     3::numeric, 'gousse',4),
      ('Champignon de Paris',   250::numeric, 'g',     5),
      ('Vin rouge',             750::numeric, 'ml',    6),
      ('Farine de blé T55',      30::numeric, 'g',     7),
      ('Beurre doux',            50::numeric, 'g',     8),
      ('Huile d''olive',         30::numeric, 'ml',    9),
      ('Thym',                    1::numeric, 'botte',10),
      ('Laurier',                 2::numeric, 'piece',11),
      ('Persil plat',             1::numeric, 'botte',12),
      ('Sel',                     8::numeric, 'g',    13),
      ('Poivre noir',             3::numeric, 'g',    14)
    ) as q(name, qty, unit, pos);

    insert into public.recipe_step (
      recipe_step_recipe_id, recipe_step_position, recipe_step_text
    ) values
      (v_id, 0, 'Coupez le bœuf en gros cubes de 4-5 cm. Salez, poivrez et farinez-les légèrement.'),
      (v_id, 1, 'Dans une cocotte, faites chauffer l''huile et la moitié du beurre. Faites dorer la viande sur toutes les faces, par petites quantités pour bien la saisir. Réservez.'),
      (v_id, 2, 'Dans la cocotte, faites revenir les lardons, puis ajoutez les oignons émincés et les carottes coupées en rondelles. Laissez fondre 5 min. Ajoutez l''ail écrasé.'),
      (v_id, 3, 'Remettez la viande, versez le vin rouge, ajoutez le bouquet (thym, laurier, persil), salez. Portez à frémissement, couvrez et laissez mijoter à feu doux 2h30.'),
      (v_id, 4, '30 min avant la fin, ajoutez les champignons coupés en quartiers, préalablement poêlés dans le reste de beurre.'),
      (v_id, 5, 'Goûtez, rectifiez l''assaisonnement. Servez avec des pommes de terre vapeur ou des pâtes fraîches.');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. PÂTE À CRÊPES
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.recipe
    where recipe_title = 'Pâte à crêpes'
      and recipe_visibility = 'public'
      and recipe_owner_id is null
  ) then
    insert into public.recipe (
      recipe_visibility, recipe_owner_id, recipe_title, recipe_description,
      recipe_time_prep_minutes, recipe_time_cook_minutes, recipe_time_rest_minutes,
      recipe_calories, recipe_servings
    ) values (
      'public', null, 'Pâte à crêpes',
      'La base universelle : à servir sucrée (sucre, citron, Nutella, confiture) ou salée en galette. Le repos de la pâte est essentiel pour des crêpes fines et souples. Pour ~15 crêpes.',
      10, 25, 60, 150, 15
    ) returning recipe_id into v_id;

    insert into public.recipe_ingredient (
      recipe_ingredient_recipe_id, recipe_ingredient_catalog_id,
      recipe_ingredient_quantity, recipe_ingredient_unit, recipe_ingredient_position
    )
    select v_id,
           (select ingredient_id from public.ingredient where ingredient_name = q.name),
           q.qty, q.unit::public.meal_unit, q.pos
    from (values
      ('Farine de blé T45',  250::numeric, 'g',     0),
      ('Œuf',                  4::numeric, 'piece', 1),
      ('Lait demi-écrémé',   500::numeric, 'ml',    2),
      ('Beurre doux',         50::numeric, 'g',     3),
      ('Sel',                  2::numeric, 'g',     4),
      ('Sucre',               25::numeric, 'g',     5),
      ('Rhum',                30::numeric, 'ml',    6)
    ) as q(name, qty, unit, pos);

    insert into public.recipe_step (
      recipe_step_recipe_id, recipe_step_position, recipe_step_text
    ) values
      (v_id, 0, 'Dans un saladier, versez la farine en formant un puits. Cassez les œufs au centre, ajoutez le sel et le sucre. Mélangez au fouet en incorporant progressivement la farine.'),
      (v_id, 1, 'Faites fondre le beurre. Ajoutez-le tiède au mélange, puis versez le lait petit à petit en fouettant pour éviter les grumeaux.'),
      (v_id, 2, 'Si la pâte fait des grumeaux, passez-la au tamis ou mixez-la 10 secondes.'),
      (v_id, 3, 'Ajoutez le rhum si vous le souhaitez. Couvrez et laissez reposer au moins 1h à température ambiante.'),
      (v_id, 4, 'Faites chauffer une poêle à crêpes légèrement beurrée. Versez une louche de pâte, tournez la poêle pour répartir, cuisez 1 min de chaque côté. Empilez les crêpes au fur et à mesure.');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. BLANQUETTE DE VEAU
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.recipe
    where recipe_title = 'Blanquette de veau'
      and recipe_visibility = 'public'
      and recipe_owner_id is null
  ) then
    insert into public.recipe (
      recipe_visibility, recipe_owner_id, recipe_title, recipe_description,
      recipe_time_prep_minutes, recipe_time_cook_minutes, recipe_time_rest_minutes,
      recipe_calories, recipe_servings
    ) values (
      'public', null, 'Blanquette de veau',
      'Plat français traditionnel à la sauce blanche crémeuse : veau mijoté avec carottes, poireau, champignons et liaison au jaune d''œuf et au citron. À servir avec du riz blanc.',
      30, 105, null, 520, 6
    ) returning recipe_id into v_id;

    insert into public.recipe_ingredient (
      recipe_ingredient_recipe_id, recipe_ingredient_catalog_id,
      recipe_ingredient_quantity, recipe_ingredient_unit, recipe_ingredient_position
    )
    select v_id,
           (select ingredient_id from public.ingredient where ingredient_name = q.name),
           q.qty, q.unit::public.meal_unit, q.pos
    from (values
      ('Épaule de veau',       1200::numeric, 'g',     0),
      ('Carotte',               300::numeric, 'g',     1),
      ('Oignon jaune',            1::numeric, 'piece', 2),
      ('Poireau',                 1::numeric, 'piece', 3),
      ('Champignon de Paris',   250::numeric, 'g',     4),
      ('Beurre doux',            30::numeric, 'g',     5),
      ('Farine de blé T55',      30::numeric, 'g',     6),
      ('Crème fraîche',         200::numeric, 'g',     7),
      ('Œuf',                     1::numeric, 'piece', 8),
      ('Citron',                  1::numeric, 'piece', 9),
      ('Thym',                    1::numeric, 'botte',10),
      ('Laurier',                 2::numeric, 'piece',11),
      ('Sel',                     8::numeric, 'g',    12),
      ('Poivre noir',             3::numeric, 'g',    13)
    ) as q(name, qty, unit, pos);

    insert into public.recipe_step (
      recipe_step_recipe_id, recipe_step_position, recipe_step_text
    ) values
      (v_id, 0, 'Coupez le veau en cubes de 4 cm. Mettez-le dans une grande casserole, couvrez d''eau froide, portez à ébullition et écumez la mousse pendant 5 min.'),
      (v_id, 1, 'Ajoutez les carottes en rondelles, l''oignon émincé, le poireau coupé en tronçons, le thym et le laurier. Salez, poivrez.'),
      (v_id, 2, 'Baissez le feu, couvrez et laissez mijoter 1h30.'),
      (v_id, 3, 'Pendant ce temps, faites sauter les champignons coupés en quartiers dans un peu de beurre. Réservez.'),
      (v_id, 4, 'Retirez la viande et les légumes. Filtrez le bouillon. Dans la cocotte, faites un roux : faites fondre 30g de beurre, ajoutez la farine, mélangez et versez 500 ml de bouillon en fouettant. Laissez épaissir.'),
      (v_id, 5, 'Ajoutez la viande, les carottes et les champignons. Hors du feu, mélangez la crème fraîche avec le jaune d''œuf et le jus de citron, et versez dans la sauce en remuant. Ne faites plus bouillir.'),
      (v_id, 6, 'Servez avec du riz blanc.');
  end if;
end $$;
