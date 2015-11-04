---
layout: post
title: Monter ses environnements de développement avec docker - Partie 3
permalink: monter-ses-environnements-de-developpement-avec-docker-partie-3/
logo: /assets/img/baleine3.jpg
tags: docker fr
categories: post
excerpt: Comment utiliser les images précédement créées ? Architecture des environnements de développement - Utilisation de docker-compose - Gestion des droits sur les fichier partagés entre l'hôte et les conteneurs - Persistance des données - Exemples d'environnements pour des projets Magento, Symfony, Django, Express.js, Sails.js
---
Cette article est le dernier d'une série de trois. Ces articles ne sont pas destinés à enseigner `Docker`, mais ils proposent une solution de gestion d'environnements de développement l'utilisant.

Nous avons vu [pourquoi `Docker` était intéressant pour monter des environnements de développement](/monter-ses-environnements-de-developpement-avec-docker-partie-1) et [nous avons créé une série d'images qui nous seront utiles](/monter-ses-environnements-de-developpement-avec-docker-partie-2). Voyons à présent comment utiliser ces images avec quelques cas concrets.

## Architecture des environnements de développement

### Utilisation de docker-compose

[`Docker-compose`](https://docs.docker.com/compose/) (anciennement [`Fig`](http://www.fig.sh/)) est un outil qui permet de facilement **définir, démarrer et arrêter un environnement de développement avec Docker.** Le principe est d'écrire un fichier `docker-compose.yml` qui décrira les conteneurs à lancer avec les mêmes options disponibles que pour la commande `docker run` :

* `image` pour spécifier l'image à utiliser.
* `links` pour lier un conteneur à un autre.
* `port` pour publier un port sur la machine hôte.
* `volume` pour partager un dossier entre la machine hôte et un conteneur.
* [etc ...](https://docs.docker.com/compose/yml/)

De plus, l'option `build` permet de spécifer un chemin vers un `Dockerfile`, permettant ainsi d'utiliser une ou plusieurs images spécifiques au projet.

Ensuite, la commande `docker-compose` permettra de facilement créer, démarrer, arrêter et détruire les conteneurs :

    # Créer les images spécifiques au projet
    $ docker-compose build

    # Créer l'environnement
    $ docker-compose up

    # Arrêter l'environnement
    $ docker-compose stop

    # Redémarrer l'environnement
    $ docker-compose start

    # Supprimer les conteneurs
    $ docker-compose rm


### Arborescence générale
Chaque environnement de développement que nous allons mettre en place suivra les mêmes principes :

* Un dossier `/src` à la racine du projet contiendra le code de l'application.
* Un fichier `/docker-compose.yml` décrira les conteneurs composant l'environnement.
* Des dossiers `/docker-compose/<nom_image>` contiendront les `Dockerfiles` nécessaires à l'environnement de développement.
* Un dossier `/docker-compose/data` contiendra les données des volumes partagés entre les conteneurs et la machine hôte : fichiers de la base de données, fichiers de logs ... à l'exception des sources qui se trouvent dans `/src`.

A vous de modifier cette structure pour vos projets si vous le souhaitez.

### Gestion des droits sur les fichiers partagés entre les conteneurs et la machine hôte
Pour chaque environnement de développement, **les sources du projet appartiendront à l'utilisateur `dev` du conteneur**. Si l'utilisateur de la machine hôte a un couple `UID` / `GID` différent de 1000, on pourra **utiliser la commande `change-dev-id`** [décrite dans l'article précédent](/monter-ses-environnements-de-developpement-avec-docker-partie-2/#Gestion%20des%20droits%20sur%20les%20fichiers%20partag%C3%A9s%20entre%20les%20conteneurs%20et%20la%20machine%20h%C3%B4te).

En revanche, **les ressources du dossier `/docker-compose/data`** (fichiers de base de données et fichiers de log) **appartiendront à l'utilisateur du service correspondant** (mysql, postgresql, www-data ...). On pourra les consulter avec l'utilisateur `root` ou en utilisant `sudo`.

### Persistance et partage pour les serveurs de base de données
Pour chaque serveur de base de données qui composera l'un de nos environnement de développement, **un `volume` fera persister les données sur la machine hôte**, dans le dossier `/docker-compose/data/db`. Si plusieurs développeurs travaillent sur le projet, il sera alors facile de **récupérer les données d'un collègue sans être obligé d'exécuter un dump potentiellement long**. Les images utilisées par les deux développeurs étant identiques, on peut archiver et partager directement les fichers de la base de données en prenant soins de ne pas modifier les droits. Par exemple avec la commande `tar` exécutée en tant qu'administrateur.

    # Archivage des données depuis l'environnement de développement A
    $ cd /chemin/vers/le/projet/sur/A/docker-compose/data/
    $ sudo tar cvzf db.tar.gz db

    # Récupérer l'archive créée depuis l'environnement de développement B avec scp,
    $ scp utilisateur@machine-A:/chemin/vers/le/projet/sur/A/docker-compose/data/db.tar.gz /chemin/vers/le/projet/sur/B/docker-compose/data/db.tar.gz

    # Extration des données
    $ cd /chemin/vers/le/projet/sur/B/docker-compose/data/
    $ sudo tar xvzf db.tar.gz


## Environnements Magento

### Apache / MariaDB / Memcached
Pour ce premier environnement de développement, nous allons mettre en place une application `Magento` se connectant à une base de données `MariaDB` et stockant les sessions et le cache dans un serveur `memcached`. **Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/magento/apache-php_mariadb_memcached)**.

Nous n'avons pas besoin de surcharger la configuration des images `alexisno/mariadb-dev`, `alexisno/memcached-dev` et `alexisno/mailcatcher-dev` pour notre environnement de développement et **nous utiliserons directement ces images**.

Par contre, nous allons **créer un `Dockerfile` pour surcharger l'image `alexisno/apache-php-dev`** pour différentes raisons :

* installer les extensions `PHP` dont nous avons besoin : `php5-curl`, `php5-mcrypt`, `php5-gd`, `php5-mysql` et `php5-memcached`.
* ajouter un fichier contenant les virtualhosts pour `Apache`.
* générer des certificats auto-signé pour pouvoir naviguer sur en `https` sur les pages de l'interface d'administration et sur les pages sécurisées de la boutique.
* configurer le fichier `php.ini` pour enregistrer les sessions dans le conteneur `alexisno/memcached-dev`
* installer `n98-magerun` qui fourni des outils en ligne de commande pour `Magento`.
* créer une commande qui permettra d'installer automatiquement une version de `Magento`.

Sur la machine hôte, il ne faudra pas oublier d'ajouter une ligne au fichier `/etc/hosts` pour associer l'adresse IP locale aux adresses déclarées dans les virtualhosts :
```
127.0.0.1 magento.local www.magento.local admin.magento.local
```
Notez que ces adresses sont déclarées comme des variables d'environnement dans le `Dockerfile` pour pouvoir être facilement remplacées par un nom plus spécifique au projet.

Enfin, pour démontrer le fonctionnement de l'environnement et/ou permettre un démarrage de projet rapide, une commande `generate-app` permettra d'installer automatiquement une version de `Magento`. Cette commande utilise `n98-magerun`. On peut aussi utiliser des sources déjà existantes en les plaçant dans ce dossier `/src` et en configurant la base de données qui sera accessible à l'adresse `127.0.0.1:3306`.

### Nginx / MariaDB / Memcached
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/magento/nginx-php_mariadb_memcached)**.

La configuration de cet environnement est très similaire à celle du précédent. Seul le fichier virtualhost écrit pour `Nginx` à la place de `Apache` change.

## Environnements Symfony

### Apache / MariaDB
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/symfony/apache-php-mariadb)**.

Nous n'avons pas besoin de surcharger la configuration des images `alexisno/mariadb-dev`, et `alexisno/mailcatcher-dev` pour notre environnement de développement et **nous utiliserons directement ces images**.

Par contre, nous allons **créer un `Dockerfile` pour surcharger l'image `alexisno/apache-php-dev`** pour différentes raisons :

* installer les extensions `PHP` dont nous avons besoin : `php5-intl` et `php5-mysql`.
* ajouter un fichier contenant un virtualhost pour `Apache`.
* générer un certificat auto-signé pour pouvoir naviguer sur en `https` sur les pages de notre application.
* créer une commande qui permettra d'installer automatiquement une version de `Symfony`.

Comme pour les environnements `Magento`, il ne faudra pas oublier d'ajouter une ligne au fichier `/etc/hosts` pour associer l'adresse IP locale à l'adresse déclarée dans le virtualhost :
```
127.0.0.1 symfony.local
```
Comme pour les environnements `Magento` cette adresse est délarée comme une variable d'environnement dans le `Dockerfile` pour pouvoir être facilement remplacée par un nom plus spécifique au projet.

La distribution standard de `Symfony 2` pourra être installée en utilisant la commande `generate-app`. Si l'on dispose déjà du code source du projet, il suffit de placer les fichiers dans le dossier `/src` sur la machine hôte.

### Nginx / PostgreSQL
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/symfony/nginx-php-postgresql)**.

Voici les différences avec l'environnement précédent :

* Origine des images
* Ecriture d'un fichier virtualhost `Nginx` à la place de `Apache`

Comme précédement, nous surchargeons l'image du serveur web (ici `alexisno/nginx-php`) pour installer les extensions `PHP` utiles au projet, un certificat auto-signé et une commande qui installera `Symfony`.

## Environnements Node.js

### Express.js / Nginx
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/express)**.

Cet environnement `Express.js` comporte un conteneur `Node.js` et un conteneur `Nginx`.

La ligne à ajouter au fichier `/etc/hosts` pour associer l'adresse IP locale à l'adresse déclarée par défaut dans le virtualhost est la suivante :
```
127.0.0.1 express.local
```

### Sails.js / Nginx / MongoDB
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/sails)**.

[`Sails.js`](http://sailsjs.org/) est un framework MVC basé sur `Express.js` et `socket.io`. Il permet notamment de réaliser très rapidement des services `REST`.

Cet environnement `Sails.js` comporte un conteneur `Node.js`, un conteneur `Nginx` et un conteneur `MongoDB`.

La ligne à ajouter au fichier `/etc/hosts` pour associer l'adresse IP locale à l'adresse déclarée par défaut dans le virtualhost est la suivante :
```
127.0.0.1 sails.local
```

Comme pour les environnements précédents, cet environnement créera automatiquement une application d'exemple si les sources de `Sails.js` ne sont pas déjà présentes. Cette application par défaut présente une api `REST` (à l'adresse http://sails.local/demo) que vous pouvez tester avec un outil comme [`Postman`](http://www.getpostman.com/).

## Vos environnements !
A vous de créer les images pour les langages et les technologies qui vous intéressent avec les outils de travail que vous préférez et de les décliner en fonction de vos besoins.
