---
layout: post
title: Monter ses environnements de développement avec Docker - Partie 1
permalink: monter-ses-environnements-de-developpement-avec-docker-partie-1/
logo: /assets/img/baleine1.jpg
tags: docker fr
categories: post
excerpt: "Cet article est une introduction pour expliquer les raisons d'utiliser Docker pour monter des environnements de développement. Les articles suivants proposeront une solution pour la mise en place de ces environnements de développement. Qu'est ce que Docker ? Pourquoi l'utiliser pour votre environnement de développement ?"
---
Cet article est le premier d'une série de trois. Ces articles ne sont pas destinés à enseigner Docker, mais ils proposent une solution de gestion d'environnements de développement l'utilisant.


## Pourquoi ces articles ?
Cet article est une introduction pour expliquer les raisons d'utiliser Docker pour monter des environnements de développement. Les articles suivants proposeront une solution pour la mise en place de ces environnements de développement.

Attention : **ces articles ne traitent exclusivement que d'environnements de développement.** Certains choix techniques fait ici seraient probablement perçus comme de mauvaises pratiques et seraient proscrits pour une utilisation en production. Bien sûr, Docker existe aussi pour faciliter le déployement d'une application sur différents environnements (QA, preprod, prod ...) mais à mon avis, un environnement de développement contient suffisamment de particularités pour utiliser sa propre image avec des règles moins strictes que sur les autres environnements : outils de debug, accès aux logs, tests de modification de configuration ...


## Qu'est ce que Docker ?
<img src="/assets/img/logo_docker.png" style="float:right; margin:3%" alt="logo docker" title="logo docker" />

[Docker](http://www.docker.io) est un outil de  qui permet de créer des conteneurs d'application, basé sur [lxc](https://linuxcontainers.org/) (Linux Containers).

Contrairement à une machine virtuelle, **un conteneur Docker n'a pas besoin d'exécuter un système d'exploitation pour faire fonctionner une application**. C'est le kernel de la machine hôte qui est utilisé. Un conteneur Docker contient l'application et ses dépendances. Il les exécute indépendament des programmes et des librairies qui peuvent être installées sur la machine hôte. **Docker permet ainsi de faire de la virtualisation "légère"**.

[Vous trouverez ici](https://www.docker.com/whatisdocker/) une petite page d'explication rapide.

Docker fait donc fonctionner des processus linux sur une machine hôte sous linux. Si vous ne développez pas sur une machine linux, il existe des outils pour faciliter l'installation d'une machine virtuelle dédiée à Docker pour [Mac](https://docs.docker.com/installation/mac/) ou pour [Windows](https://docs.docker.com/installation/windows/). Cette machine virtuelle utilise la distribution [Boot2Docker](http://boot2docker.io/). Sinon, vous pouvez utiliser l'outil qui vous conviendra le mieux pour gérer votre machine virtuelle linux, mais ce sujet ne sera pas abordé ici.

Avant de lire les articles suivants, il faudra vous assurer de comprendre les bases de [Docker](https://docs.docker.com/) et l'utilisation des [Dockerfiles](https://docs.docker.com/reference/builder/).


## Pourquoi l'utiliser pour votre environnement de développement ?

### Le besoin : un environnement de développement sur mesure
Vous travaillez sur plusieurs projets et chacun de ces projets a un environnement d'exécution spécifique : différences de langage, de serveur de base de données, de serveur de cache, différences de version ou des extensions installées.

**Il devient difficile d'installer toutes les versions de tous les programmes ou librairies requis sur un poste de dévelopement.** Les versions vont entrer en conflit et beaucoup de services risquent de fonctionner inutilement et de ralentir le démarrage, le fonctionnement et l'arrêt de la machine.

### Une solution : la virtualisation
Pour palier à ce problème, une solution communément utilisée est de **faire fonctionner les différentes application dans des machines virtuelles** (avec VMware ou Virtualbox, potentiellement en utilisant Vagrant) sur lesquelles on installe les programmes et librairies permettant de faire fonctionner chaque application. Il suffit de démarrer la machine virtuelle associée à un projet lorsque l'on souhaite travailler dessus.

Lorsque l'on travaille en équipe on peut alors **partager une image de la machine virtuelle** à utiliser pour le projet. Si un nouveau composant doit être installé ou une version de programme changée, la modification est facilement récupérable par chaque développeur en mettant à jour la machine virtuelle sur son poste de travail.

**Le problème c'est que les machines virtuelles sont lourdes**, lentes à démarrer et consomment beaucoup de ressources (RAM et CPU) de la machine hôte pour faire fonctionner cette deuxième machine. Il est difficilement envisageable de faire fonctionner simultanément plusieurs machines virtuelles sur un poste de développement.

### Une meilleure solution : Docker
Docker permet de résoudre ces problèmes et apporte plus de flexibilité dans la construction d'un environnement de développement. **Il n'est pas coûteux de faire tourner plusieurs conteneurs** (et non plus machines virtuelles) sur la même machine puisqu'il n'est pas nécessaire d'exécuter un système d'exploitation supplémentaire et d'allouer spécifiquement une partie de son CPU et de sa RAM.

On peut facilement **lier plusieurs conteneurs** pour faire fonctionner l'application : un pour le serveur web, un autre pour la base de donnée, un troisième pour le serveur de cache ... Il devient alors extrémenent simple de tester son application sur un nouveau serveur de base de donnée ou une autre version du langage de programmation.

On a ainsi les avantages de la performance native et les avantages de l'isolation des dépendances et de l'exécution de l'application.

---

[Lire la suite à propos de la rédaction de Dockerfiles et la création d'images](/monter-ses-environnements-de-developpement-avec-docker-partie-2/)
