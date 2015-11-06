---
layout: post
title: Monter ses environnements de développement avec docker - Partie 3
permalink: monter-ses-environnements-de-developpement-avec-docker-partie-3/
logo: /assets/img/baleine3.jpg
tags: docker fr
categories: post
excerpt: "Comment utiliser les images précédement créées ? Architecture des environnements de développement - Utilisation de docker-compose - Gestion des droits sur les fichier partagés entre l'hôte et les conteneurs - Persistance des données - Exemples d'environnements pour des projets Magento, Symfony, Express.js, Sails.js."
---
Cette article est le dernier d'une série de trois. Ces articles ne sont pas destinés à enseigner `Docker`, mais ils proposent une solution de gestion d'environnements de développement l'utilisant.

Nous avons vu [pourquoi `Docker` était intéressant pour monter des environnements de développement](/monter-ses-environnements-de-developpement-avec-docker-partie-1) et [nous avons créé une série d'images qui nous seront utiles](/monter-ses-environnements-de-developpement-avec-docker-partie-2). Voyons à présent comment utiliser ces images avec quelques cas concrets.


## Architecture des environnements de développement

### Utilisation de docker-compose

[`Docker-compose`](https://docs.docker.com/compose/) (anciennement `Fig`) est un outil qui permet de facilement **définir, démarrer et arrêter un ensemble de conteneurs.** Le principe est d'écrire un fichier `docker-compose.yml` qui décrira les conteneurs à lancer avec des options similaires à celles de la commande `docker run` :

* `image` pour spécifier l'image à utiliser.
* `links` pour lier un conteneur à un autre.
* `port` pour publier un port sur la machine hôte.
* `volume` pour partager un dossier entre la machine hôte et un conteneur.
* [etc ...](https://docs.docker.com/compose/yml/)

De plus, l'option `build` permet de spécifer un chemin vers un `Dockerfile`, permettant ainsi de surchager une image avec une configuration spécifique au projet.

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

Il existe beaucoup d'autres [commandes utiles](http://docs.docker.com/v1.7/compose/cli/).

### Arborescence générale

Chaque environnement de développement que nous allons mettre en place suivra les mêmes principes :

* Un dossier `/src` à la racine du projet contiendra le code de l'application.
* Un fichier `/docker-compose.yml` décrira les conteneurs composant l'environnement.
* Des dossiers `/docker-compose/<nom_image>` contiendront les `Dockerfiles` nécessaires à l'environnement de développement.
* Un dossier `/docker-compose/data` pourra contenir les points de montage de certains volumes contenant des fichiers qu'il peut être utile de pouvoir consulter facilement depuis la machine hôte (des fichiers de logs par exemple).

A vous de modifier cette structure pour vos projets si vous le souhaitez.

### Gestion des droits sur les fichiers partagés entre les conteneurs et la machine hôte

Pour chaque environnement de développement, **les sources du projet appartiendront à l'utilisateur `dev` du conteneur**. Si l'utilisateur de la machine hôte a un couple `UID` / `GID` différent de 1000, on pourra **utiliser la commande `change-dev-id`** [décrite dans l'article précédent](http://127.0.0.1:4000/monter-ses-environnements-de-developpement-avec-docker-partie-2/#gestion-des-droits-sur-les-fichiers-partags-entre-les-conteneurs-et-la-machine-hte).

En revanche, **les ressources du dossier `/docker-compose/data` appartiendront éventuellement à un autre utilisateur** (mysql, postgresql, www-data ...). Si tel est le cas, ces fichiers auront des permissions qui ne correspondront pas à l'environnement de la machine hôte. Si l'utilisateur de la machine hôte n'y a pás accès on pourra consulter ces fichiers avec l'utilisateur `root` ou en utilisant `sudo`.

### Persistance et partage pour les serveurs de base de données

Pour chaque serveur de base de données qui composera l'un de nos environnement de développement, on utilisera **un conteneur dédié au partage d'un volume** pour la persistance, la sauvegarde et la restauration de données. Ceci fourni plusieurs avantages:

* On ne risque pas de perdre ses données de test en utilisant la commande `docker-compose rm`.
* On pourra facilement créer différents conteneurs dédiés au partage de volume pour réaliser des tests avec des schémas et/ou données différentes.
* Si plusieurs développeurs travaillent sur le projet, il sera facile de **récupérer les données d'un collègue sans être obligé d'exécuter un dump potentiellement long**.


## Environnements Magento

### Apache / MariaDB / Memcached
Pour ce premier environnement de développement, nous allons mettre en place une application `Magento` se connectant à une base de données `MariaDB` et stockant les sessions et le cache dans un serveur `memcached`. **Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/magento/apache-php_mariadb_memcached)**.

Nous allons **créer un `Dockerfile` pour surcharger l'image `alexisno/apache-php-dev`** pour différentes raisons :

* installer les extensions `PHP` dont nous avons besoin : `php5-curl`, `php5-mcrypt`, `php5-gd`, `php5-mysql` et `php5-memcached`.
* ajouter un fichier contenant les virtualhosts pour `Apache`.
* générer des certificats auto-signé pour pouvoir naviguer sur en `https` sur les pages sécurisées du site et sur les pages de l'interface d'administration.
* configurer le fichier `php.ini` pour enregistrer les sessions dans le conteneur `memcached`
* installer `n98-magerun` qui fourni des outils en ligne de commande pour `Magento`.
* créer une commande qui permettra d'installer automatiquement une version de `Magento` (étape non indispensable, mais qui permettra d'avoir un environnement complet encore plus rapidement).

Sur la machine hôte, il ne faudra pas oublier d'ajouter une ligne au fichier `/etc/hosts` pour associer l'adresse IP locale aux adresses déclarées dans les virtualhosts :

<pre><code class="bash">127.0.0.1 magento.local www.magento.local admin.magento.local</code></pre>

Notez que ces adresses sont déclarées comme des variables d'environnement dans le `Dockerfile` pour pouvoir être facilement remplacées par un nom plus spécifique au projet.

Une commande `generate-app` permettra d'installer automatiquement `Magento`. Cette commande utilise `n98-magerun`. On peut aussi utiliser des sources déjà existantes en configurant l'accès à la base de données à l'adresse `db:3306` dans le fichier `/app/etc/local.xml`.

**Mise à jour novembre 2015:** Depuis peu, il n'est plus possible de télécharger Magento sans passer par le site web. La commande `n98-magerun install` ne peut donc plus faire le télechargement automatiquement. Il faut utiliser un navigateur et se loguer sur le site pour télecharger la dernière version.

Une fois les sources de magento installées dans le dossier `src`, voici les commandes à effecter pour installer l'environnement:

    # Création du conteneur dédié au volume
    $ docker run --name magento-data -d -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=magento -e MYSQL_USER=magento -e MYSQL_PASSWORD=magento mariadb

    # Arrêt du conteneur dédié au volume. En effet, il n'est pas nécessaire qu'il continue de fonctionner, il ne sert qu'à référencer un volume.
    $ docker stop magento-data

    # "build" de l'image spécifique au projet
    $ docker-compose build

    # Installation de Magento: génération des tables et du fichier /app/etc/local.xml
    $ docker-compose run web generate-app

    # Lancement de l'environnement
    $ docker-compose up

Accédez au site à l'adresse http://www.magento.local/ et à l'interface d'administration à l'adresse https://admin.magento.local/admin (login: *admin*, mot de passe: *password123*).

Pour relancer l'environnement plus tard, il suffit d'utiliser `docker-compose up` ou `docker-compose start`.

### Nginx / MariaDB / Memcached
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/magento/nginx-php_mariadb_memcached)**.

La configuration de cet environnement est très similaire à celle du précédent. Seul le fichier virtualhost écrit pour `Nginx` à la place de `Apache` change.


## Environnements Symfony

### Apache / MariaDB
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/symfony/apache-php-mariadb)**.

Nous allons **créer un `Dockerfile` pour surcharger l'image `alexisno/apache-php-dev`** pour différentes raisons :

* installer les extensions `PHP` dont nous avons besoin : `php5-intl` et `php5-mysql`.
* ajouter un fichier contenant un virtualhost pour `Apache`.
* générer un certificat auto-signé pour pouvoir naviguer sur en `https` sur les pages de notre application.
* créer une commande qui permettra d'installer automatiquement une version de `Symfony`.

Comme pour les environnements `Magento`, il ne faudra pas oublier d'ajouter une ligne au fichier `/etc/hosts` pour associer l'adresse IP locale à l'adresse déclarée dans le virtualhost :

<pre><code class="bash">127.0.0.1 symfony.local</code></pre>

Comme pour les environnements `Magento` cette adresse est délarée comme une variable d'environnement dans le `Dockerfile` pour pouvoir être facilement remplacée par un nom plus spécifique au projet.

La distribution standard de `Symfony 2` pourra être installée en utilisant la commande `generate-app`. Si l'on dispose déjà du code source du projet, il suffit de placer les fichiers dans le dossier `/src` sur la machine hôte.

Les commandes à effecter pour installer l'environnement sont similaires à celles utilisées pour `Magento` :

    # Création du conteneur dédié au volume
    $ docker run --name symfony-data -d -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=symfony -e MYSQL_USER=symfony -e MYSQL_PASSWORD=symfony mariadb

    # Arrêt du conteneur dédié au volume. En effet, il n'est pas nécessaire qu'il continue de fonctionner, il ne sert qu'à référencer un volume.
    $ docker stop symfony-data

    # "build" de l'image spécifique au projet
    $ docker-compose build

    # Installation de Symfony
    $ docker-compose run web generate-app

    # Lancement de l'environnement
    $ docker-compose up

Pour relancer l'environnement plus tard, il suffit d'utiliser `docker-compose up` ou `docker-compose start`.

### Nginx / PostgreSQL
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/symfony/nginx-php-postgresql)**.

Voici les différences avec l'environnement précédent :

* Origine des images
* Ecriture d'un fichier virtualhost `Nginx` à la place de `Apache`

Comme précédement, nous surchargeons l'image du serveur web (ici `alexisno/nginx-php`) pour installer les extensions `PHP` utiles au projet, un certificat auto-signé et une commande qui installera `Symfony`.

Pour installer l'environnement, seule la commande de création du conteneur dédié au volume change:

    # Création du conteneur dédié au volume
    docker run --name symfony-data -d -e POSTGRES_USER=symfony -e POSTGRES_PASSWORD=symfony postgres


## Environnements Node.js

### Express.js / Nginx
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/express)**.

Cet environnement `Express.js` comporte un conteneur `Node.js` et un conteneur `Nginx`.

La ligne à ajouter au fichier `/etc/hosts` pour associer l'adresse IP locale à l'adresse déclarée par défaut dans le virtualhost est la suivante :

<pre><code class="bash">127.0.0.1 express.local</code></pre>

Dans l'image `Node.js`, nous installons [`express-generator`](https://www.npmjs.com/package/express-generator) qui sera utilisé par la commande `generate-app`. Pour faciliter le développement et ne pas avoir à redémarrer les conteneurs après chaque modification, utilisons [`forever`](https://github.com/foreverjs/forever) avec l'option `-w` pour que l'application redémarrer lorsque le code est modifié. Un fichier `.foreverignore` installé par la commande `generate-app` permettra d'éviter les redémarrages lorsque l'application écrit dans les dossier `log` et `.tmp`. On pourra modifier ce fichier avec les besoins de l'application.

Cet environnement ne comprend pas de serveur de base de données, nous n'avons qu'à utiliser trois lignes de commande pour le mettre en place.

    # "build" des images spécifiques au projet
    $ docker-compose build

    # Génération d'une application Express.js
    $ docker-compose run nodejs generate-app

    # Lancement de l'environnement
    $ docker-compose up


### Sails.js / Nginx / MongoDB
**Vous trouverez les sources nécessaires à la mise en place de cet environnement [ici](https://github.com/AlexisNo/dev-dockerfiles/tree/master/examples/sails)**.

[`Sails.js`](http://sailsjs.org/) est un framework MVC basé sur `Express.js` et `socket.io`. Il permet notamment de créer rapidement des services `REST` et est très bon pour faire des applications temps réel.

Cet environnement `Sails.js` comporte un conteneur `Node.js`, un conteneur `Nginx` et un conteneur `MongoDB`.

La ligne à ajouter au fichier `/etc/hosts` pour associer l'adresse IP locale à l'adresse déclarée par défaut dans le virtualhost est la suivante :

<pre><code class="bash">127.0.0.1 sails.local</code></pre>

La configuration de `Nginx` supporte les connections websockets.

Contrairement aux environnements précédents, pour présenter une alternative, nous n'utilisons pas de conteneur dédié à un volume pour la persistance des données, mais nous stockons les données du serveur mongodb dans le dossier `docker-compose/data/`. Nous n'avons qu'à utiliser trois lignes de commande pour mettre l'environnement en place.

    # "build" des images spécifiques au projet
    $ docker-compose build

    # Génération d'une application Express.js
    $ docker-compose run nodejs generate-app

    # Lancement de l'environnement
    $ docker-compose up

Vous constaterez que les permissions du dossier `docker-compose/data/mongodb` ne correspondent pas

    # Dans le conteneur, les fichiers de la base de données ont des permissions correctes
    # ils appartiennent à l'utilisateur et au groupe "mongodb"
    docker exec sails_db_1 ls -la /data/db
    total 163860
    drwxr-xr-x 3 mongodb root        4096 Nov  6 13:24 .
    drwxr-xr-x 3 root    root        4096 Sep  9 22:37 ..
    drwxr-xr-x 2 mongodb mongodb     4096 Nov  6 14:17 journal
    -rw------- 1 mongodb mongodb 67108864 Nov  6 14:17 local.0
    -rw------- 1 mongodb mongodb 16777216 Nov  6 14:17 local.ns
    -rwxr-xr-x 1 mongodb mongodb        2 Nov  6 14:17 mongod.lock
    -rw------- 1 mongodb mongodb 67108864 Nov  6 13:54 sails.0
    -rw------- 1 mongodb mongodb 16777216 Nov  6 13:54 sails.ns
    -rw-r--r-- 1 mongodb mongodb       69 Nov  6 13:17 storage.bson

    # Sur la machine hôte, l'utilisateur mongodb n'existe pas. Les permissions sont erronées
    # et il ne faut pas les modifier sous peine de
    $ ls -la docker-compose/data/mongodb
    total 163856
    drwxr-xr-x 3  999 root       4096 Nov  6 11:24 .
    drwxr-xr-x 3 root root       4096 Nov  6 11:17 ..
    drwxr-xr-x 2  999 docker     4096 Nov  6 12:12 journal
    -rw------- 1  999 docker 67108864 Nov  6 11:39 local.0
    -rw------- 1  999 docker 16777216 Nov  6 11:39 local.ns
    -rwxr-xr-x 1  999 docker        0 Nov  6 12:12 mongod.lock
    -rw------- 1  999 docker 67108864 Nov  6 11:54 sails.0
    -rw------- 1  999 docker 16777216 Nov  6 11:54 sails.ns
    -rw-r--r-- 1  999 docker       69 Nov  6 11:17 storage.bson


Comme pour les environnements précédents, une commande `generate-app` permet de générer une application permettant de tester rapidement l'environnement. Cette application par défaut présente une api `REST` pour manipuler une resource `demo` (à l'adresse http://sails.local/demo) que vous pouvez tester avec un outil comme [`Postman`](http://www.getpostman.com/).

Sails présente aussi des routes qui permettent de réaliser les mêmes actions que l'api `REST` avec des requètes `GET` (à désactiver en production). Voici quelques urls permettant de tester rapidement l'api dans un navigateur ou avec `curl`:

<pre><code class="bash"># Lister les enregistrements
$ curl http://sails.local/demo

# Créer deux enregistrements
$ curl http://sails.local/demo/create?name=youpi
$ curl http://sails.local/demo/create?name=tralala

# Lister les enregistrements à nouveau
# Utilisez les ids pour réaliser les deux actions suivantes
$ curl http://sails.local/demo/

# Mettre à jour un enregistrement (remplacez l'id)
$ curl http://sails.local/demo/update/563cafc71544300f008731c1?name=chouette

# Supprimer un enregistrement (remplacez l'id)
$ curl http://sails.local/demo/destroy/563cafb01544300f008731c0

# Lister les enregistrements à nouveau
$ curl http://sails.local/demo/
</code></pre>

[`Sails.js`](http://sailsjs.org/) fourni immédiatement des fonctionnalités très puissantes qui peuvent ensuite être configurées, surchargées ou désactivées.


## Vos environnements !

A vous de créer les images pour les langages et les technologies qui vous intéressent avec les outils de travail que vous préférez et de les décliner en fonction de vos besoins.
