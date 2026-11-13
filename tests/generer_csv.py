import random
random.seed(7)
NOMS = "MARTIN BERNARD THOMAS PETIT ROBERT RICHARD DURAND DUBOIS MOREAU LAURENT SIMON MICHEL LEFEBVRE LEROY ROUX DAVID BERTRAND MOREL FOURNIER GIRARD BONNET DUPONT LAMBERT FONTAINE ROUSSEAU VINCENT MULLER LEFEVRE FAURE ANDRE MERCIER BLANC GUERIN BOYER GARNIER CHEVALIER FRANCOIS LEGRAND GAUTHIER GARCIA PERRIN ROBIN CLEMENT MORIN NICOLAS HENRY ROUSSEL MATHIEU GAUTIER MASSON MARCHAND DUVAL DENIS DUMONT MARIE LEMAIRE NOEL MEYER DUFOUR MEUNIER BRUN BLANCHARD GIRAUD JOLY RIVIERE LUCAS BRUNET GAILLARD BARBIER ARNAUD MARTINEZ GERARD ROCHE RENARD SCHMITT ROY LEROUX COLIN VIDAL CARON PICARD ROGER FABRE AUBERT LEMOINE RENAUD DUMAS LACROIX OLIVIER PHILIPPE BOURGEOIS PIERRE BENOIT REY LECLERC PAYET ROLLAND LECLERCQ GUILLAUME LECOMTE LOPEZ JEAN DUPUY GUILLOT HUBERT BERGER CARPENTIER SANCHEZ DUPUIS MOULIN LOUIS DESCHAMPS HUET VASSEUR PEREZ BOUCHER FLEURY ROYER KLEIN JACQUET ADAM PARIS POIRIER MARTY AUBRY GUYOT CARRE CHARLES RENAULT CHARPENTIER MENARD MAILLARD BARON BERTIN BAILLY HERVE SCHNEIDER FERNANDEZ LE GALL COLLET LEGER BOUVIER JULIEN PREVOST MILLET PERROT DANIEL LE ROUX COUSIN GERMAIN BRETON BESSON LANGLOIS REMY LE GOFF PELLETIER LEVEQUE PERRIER LEBLANC BARRE LEBRUN MARCHAL WEBER MALLET HAMON BOULANGER JACOB MONNIER MICHAUD RODRIGUEZ GUICHARD GILLET ETIENNE GRONDIN POULAIN TESSIER CHEVALLIER COLLIN CHAUVIN DA SILVA BOUCHET GAY LEMAITRE BENARD MARECHAL HUMBERT REYNAUD ANTOINE HOARAU PERRET BARTHELEMY CORDIER PICHON LEJEUNE GILBERT LAMY DELAUNAY PASQUIER CARLIER LAPORTE".split()
FILLES = "Emma Jade Louise Alice Chloé Lina Léa Rose Anna Mila Inès Ambre Julia Mia Léna Manon Juliette Lou Zoé Camille Agathe Sarah Romane Jeanne Nina Eva Iris Lola Léonie Adèle Clémence Margaux Maëlys Yasmine Salomé Aya Héloïse Victoire Elsa Capucine".split()
GARCONS = "Gabriel Léo Raphaël Arthur Louis Jules Adam Maël Lucas Hugo Noah Liam Gabin Sacha Paul Nathan Aaron Mohamed Ethan Tom Éden Léon Noé Tiago Théo Isaac Marius Victor Martin Naël Mathis Axel Robin Timéo Enzo Marceau Valentin Nolan Malo Ilyes".split()
noms = random.sample(NOMS, len(NOMS))
# Liste CM2 (future 6e) : Windows-1252, point-virgule, Sexe F/M
lignes = ["Nom;Prénom;Sexe;Né(e) le;Classe"]
for i in range(112):
    f = random.random() < 0.5
    lignes.append(f"{noms[i]};{random.choice(FILLES if f else GARCONS)};{'F' if f else 'M'};{random.randint(1,28):02d}/{random.randint(1,12):02d}/2016;CM2 {random.choice('ABCDE')} - École {random.choice(['Jaurès','Prévert','Curie'])}")
open("donnees/liste_cm2.csv", "w", encoding="cp1252", newline="\r\n").write("\n".join(lignes) + "\n")
# Liste 6e (future 5e) : UTF-8 avec BOM, « Élève », LV2, ULIS, Profil
lignes = ["Élève;Sexe;Classe;LV2;ULIS;Profil"]
for i in range(112, 112 + 104):
    f = random.random() < 0.52
    lv = random.choices(["Espagnol", "Allemand", "Italien"], [0.6, 0.25, 0.15])[0]
    ulis = "X" if random.random() < 0.05 else ""
    r = random.random()
    prof = "Tête de classe" if r < .1 else "Moteur" if r < .25 else "Perturbateur" if r < .36 else "Décrocheur" if r < .43 else ""
    if prof == "Perturbateur" and random.random() < .3: prof += ", Décrocheur"
    lignes.append(f"{noms[i % len(noms)]} {random.choice(FILLES if f else GARCONS)};{2 if f else 1};6{random.choice('ABCD')};{lv};{ulis};\"{prof}\"")
open("donnees/liste_6e.csv", "w", encoding="utf-8-sig", newline="").write("\r\n".join(lignes) + "\r\n")
print("ok")
