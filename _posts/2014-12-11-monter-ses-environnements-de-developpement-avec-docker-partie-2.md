---
layout: post
title: Monter ses environnements de développement avec Docker - Partie 2
permalink: monter-ses-environnements-de-developpement-avec-docker-partie-2/
logo: /assets/img/baleine2.jpg
tags: docker fr
categories: post
excerpt: "Création une image de base - Publier sur Dockerhub - Tester et débugger - Problèmatiques liées à une installation scriptée - Gestions des permissions - Création d'images pour environnements de développement : mailcatcher, PHP, Node.js, Python, Apache, Nginx - Utilisation des images de serveur de base de données."
---
Cet article est le deuxième d'une série de trois. Ces articles ne sont pas destinés à enseigner Docker, mais ils proposent une solution de gestion d'environnements de développement l'utilisant.

Voici ce que vous devez déjà connaitre de Docker avant lire cet article :

* Qu'est ce qu'une image
* Qu'est ce qu'un conteneur
* [Qu'est ce qu'un `Dockerfile`](http://docs.docker.com/reference/builder/)
* A quoi correspondent les instructions `FROM`, `RUN`, `ENV`, `COPY`, `ADD`, `CMD` ...


Nous allons créer une image de base sur laquelle nous allons installer quelques outils courants et les configurer. Toutes les images que nous créerons ensuite seront basées sur cette image (grâce à l'instruction `FROM` de leur `Dockerfile`).


## Créer une image de base

Commençons par créer une image de base qui servira comme point de départ de toutes les images de nos environnements de développement. **Elle contiendra une série d'utilitaires et un shell personnalisé**.

### Quelle image de base pour notre image de base ?

Cette formule peut paraitre idiote, mais notre image de base doit elle même avoir pour origine une autre image. Docker fourni des images de base officielles correspondants aux principales distributions Linux.

Les critères de choix d'une image de base peuvent être :

* la préférence pour une distibution ou un sytème de gestion des packages ([`ubuntu`](https://registry.hub.docker.com/_/ubuntu/) ou [`centos`](https://registry.hub.docker.com/_/centos/) par exemple).
* la taille sur le disque (l'image officielle de [`debian`](https://registry.hub.docker.com/_/debian/) est plus petite que celle d'[`ubuntu`](https://registry.hub.docker.com/_/ubuntu/), [`busybox`](https://registry.hub.docker.com/_/busybox/) ne fait que 2,5 Mo).
* Les outils déjà présents ([`phusion/baseimage`](https://registry.hub.docker.com/u/phusion/baseimage/) est une image très populaire, mais contoversée à cause de certains choix qui y sont fait : installation de `SSH`, mise en place d'un système d'init, utilisation de `cron` et de `runit` ...)

J'ai choisi d'utiliser l'image officielle [`ubuntu`](https://registry.hub.docker.com/_/ubuntu/) car elle est la plus populaire et je n'ai pas voulu trop m'éloigner de la philosophie des concepteurs de Docker par rapport à une image comme [`phusion/baseimage`](https://registry.hub.docker.com/u/phusion/baseimage/).

### Ecriture et exécution du Dockerfile

Passons à la pratique, voici le Dockerfile qui va permettre de générer notre image de base. La version exacte que j'utilise et ses fichiers associés sont disponibles [sur ce dépot](https://github.com/AlexisNo/docker-ubuntu-dev).

    # Utilisation de ubuntu:14.04 comme image de base
    FROM ubuntu:latest

    MAINTAINER Nom Prenom "adresse@example.com"

    # Installation d'outils
    RUN apt-get update &&\
        apt-get install -y software-properties-common zsh curl wget git htop unzip vim telnet &&\
        apt-get clean && rm -rf /var/lib/apt/lists/*

    # Installation de oh-my-zsh et sélection de zsh comme shell par défault
    RUN wget https://github.com/robbyrussell/oh-my-zsh/raw/master/tools/install.sh -O - | zsh || true &&\
        chsh -s /bin/zsh

    # Configuration personnalisée de git
    # Placez un fichier .giconfig contenant vos réglage préférés
    # dans /chemin/vers/le/dossier/contenant/le/Dockerfile/root/.gitconfig
    COPY /root/.gitconfig /root/.gitconfig

    # Création d'un utilisateur non root (identifié comme "dev")
    RUN useradd dev -m -d /home/dev/ -s /bin/zsh

    # Ajout d'une commande pour modifier les UID / GID de l'utilisateur dev
    COPY /usr/bin/change-dev-id /usr/bin/change-dev-id
    RUN chmod +x /usr/bin/change-dev-id

    # Configuration de zsh et de git pour l'utilisateur dev
    USER dev
    RUN git clone git://github.com/robbyrussell/oh-my-zsh.git ~/.oh-my-zsh &&\
        sed -i 's/# DISABLE_AUTO_UPDATE=true/DISABLE_AUTO_UPDATE=true/g' ~/.zshrc &&\
        echo TERM=xterm >> /home/dev/.zshrc

    USER root
    RUN cp ~/.gitconfig /home/dev/.gitconfig && chown dev:dev /home/dev/.gitconfig

Notez l'utilisation de l'option `-y` lors de l'exécution de `apt-get install`. En effet, l'installation des packages étant scriptée, on demande à ne pas avoir à donner de confirmation. Il restera malgrès tout quelques messages de warning dus au fait qu'il n'y ai pas de prompt.

Les packages `curl`, `wget`, `git`, `htop`, `unzip`, `vim` et `telnet` fournissent des outils qui seront utiles pour les installations à réaliser dans les images filles ou pour faire du débuggage dans les conteneurs en cours d'exécution.

L'utilisateur *dev* pourra être utilisé pour effectuer les opérations qui ne nécessitent pas d'être exécutées par l'utilisateur *root*. Cet utilisateur sera aussi le propriétaire des fichiers partagés avec la machine hôte sur lesquels on devra avoir un accès en écriture (le code source du projet par exemple). Il y aura plus de détails à ce sujet [un peu plus loin dans cet article](#Gestion%20des%20droits%20sur%20les%20fichiers%20partag%C3%A9s%20entre%20les%20conteneurs%20et%20la%20machine%20h%C3%B4te).

Pour nos environnements de développement, nous souhaitons parfois ouvrir un shell dans nos conteneurs. On peut personnaliser le prompt des utilisateurs pour rendre cette utilisation plus agréable (ici en installant `oh-my-zsh` et quelques raccourcis pour `git`).

Pour générer notre image de base, on utilise la commande `docker build`. Nommons cette image `ubuntu-dev`.
<pre><code class="bash">docker build -t ubuntu-dev /chemin/vers/le/dossier/contenant/le/Dockerfile/
</code></pre>
Le chemin vers le dossier peut être relatif.

L'image est créée, on peut alors la tester en exécutant un shell dans un conteneur.
<pre><code class="bash">docker run -it ubuntu-dev /bin/zsh
</code></pre>

### Publication de l'image sur Dockerhub

L'image existe sur votre poste, partageons là avec le reste du monde.

Créez un compte sur [*Docker Hub*](https://hub.docker.com/). **Vous aurez alors un nom d'utilisateur**.

Nous avons appelé notre image `ubuntu-dev`. Pour pouvoir la publier sur Docker Hub, il faut la nommer sous la forme `utilisateurdockerhub/nom-de-l-image`. Par la suite, il faudra toujours utiliser ce nom complet.
<pre><code class="bash">docker build -t utilisateurdockerhub/ubuntu-dev /chemin/vers/le/dossier/contenant/le/Dockerfile/
</code></pre>
Il ne reste plus qu'à publier l'image.
<pre><code class="bash">docker push utilisateurdockerhub/ubuntu-dev
</code></pre>
Ca y est, l'image `utilisateurdockerhub/ubuntu-dev` est accessible depuis n'importe quel ordinateur disposant d'une connection à internet.

Pour aller plus loin, vous pouvez vous intéresser aux [builds automatisés](http://docs.docker.com/docker-hub/builds/) qui permettent de mettre à jour une image sur *Docker Hub* à chaque fois que le dépot associé sur *Github* ou *Bitbucket* est modifié.


## Problématiques et outillage pour écrire les Dockerfiles des images filles.

Ce premier `Dockerfile` était très simple et nous n'avons rencontré aucune difficulté particulière. Mais avant de poursuivre avec les images filles, arrétons nous sur quelques outils utiles pour tester et débugger

### Tester et débugger en se connectant à un conteneur en cours d'exécution

Il peut être utile d'exécuter un shell dans un conteneur, surtout pour un environnement de développement. ~~Il existe deux possibilités pour cela : faire tourner un service SSH dans les conteneurs ou utiliser `nsenter`. Personnellement, je préfère utiliser cette seconde méthode. C'est la méthode recommandée dans [un article de jpetazzo sur le blog de Docker](http://blog.docker.com/2014/06/why-you-dont-need-to-run-sshd-in-docker/). La condition est d'être root sur la machine hôte, ce qui est notre cas pour notre environnement de développement. Pour installer et utiliser simplement `nsenter`, référez vous au [dépot de jpetazzo](https://github.com/jpetazzo/nsenter) et utilisez le helper `docker-enter`.~~

La commande `exec` permet de faire ceci encore plus simplement [depuis docker 1.3](http://blog.docker.com/2014/10/docker-1-3-signed-images-process-injection-security-options-mac-shared-directories/).

    docker exec -it <id_du_conteneur> /bin/bash

### Particularités liées à l'installation scriptée

Lorsque nous avons créé l'image de base, toutes les instructions du Dockerfile se sont exécutées les unes après les autres sans interaction utilisateur : l'installation est totalement scriptée. Mais **certains packages peuvent poser problème** car durant leur installation, **ils nécessitent une interaction avec l'utilisateur** pour définir certaines valeurs de configuration. C'est le cas par exemple de MariaDB (ou de MySQL) qui demande à l'utilisateur de choisir un mot de passe root, puis de le confirmer.

La commande `debconf-set-selections` permet de prédéfinir ces valeurs de configuration. Mais il faut connaitre la clée correspondante pour pouvoir l'utiliser.

Le package `debconf-utils` contient la commande `debconf-get-selections` qui va nous permettre de retrouver les clées dont nous avons besoin. Voici la procédure à suivre pour retrouver les clées nécessaires à l'installation de MariaDB.

* Exécuter un shell dans un conteneur de l'image de base que nous avons créé précédement.
* Installer le package `debconf-utils`
* Installer MariaDB et renseigner manuellement les valeurs de configuration.
* Utiliser `debconf-get-selections` et `grep` pour retrouver les clées de configuration dont nous avons besoin
* On peut alors ajouter les lignes exécutant debconf-set-selections dans notre `Dockerfile`

**Exemple**

Nous voulons trouver les clés pour la configuration de MariaDB. Il s'agit de la demande de mot de passe root et sa confirmation.
<pre><code class="bash"># Lancer un shell dans un conteneur de notre image
$ docker run -it alexisno/ubuntu-dev /bin/zsh
# Installer le package debconf-utils
➜ apt-get update && apt-get install -y debconf-utils
# Installer le package mariadb-serveur. L'installation va demander à l'utilisateur de créer un mot de passe root
➜ apt-get install mariadb-server
# Rechercher les valeurs de configuration du package mariadb-server
➜ debconf-get-selections | grep mariadb
</code></pre>

Voici le résultat de la dernière commande :

    mariadb-server-5.5	mysql-server/root_password	password
    mariadb-server-5.5	mysql-server/root_password_again	password	mot-de-passe-root
    ...

Les clés que nous cherchons sont donc `mysql-server/root_password` et `mysql-server/root_password_again`. Dans le `Dockerfile`, on ajoutera ces instructions avant l'installation du package `mariadb-server` :

    RUN echo "mariadb-server mariadb-server/root_password password mot-de-passe-root" | debconf-set-selections
    RUN echo "mariadb-server mariadb-server/root_password_again password mot-de-passe-root" | debconf-set-selections

### Gestion des droits sur les fichiers partagés entre les conteneurs et la machine hôte

Comme indiqué plus haut, certains fichiers et dossiers partagés avec la machine hôte devront être accessibles en écriture. **Dans le conteneur, ce sera l'utilisateur `dev` qui en sera propriétaire**. Pour que l'utilisateur de la machine hôte en soit aussi propriétaire, **il faut que le couple `UID` / `GID` des deux utilisateurs soit identique**. Par défaut l'`UID` et le `GID` de l'utilisateur `dev` vaudront `1000`. Si l'on souhaite modifier ces valeurs pour les faires correspondre aux identifiants de l'utilisateur sur la machine hôte, on pourra utiliser la commande `change-dev-id` qui est inclue dans l'image de base présentée ici.

<pre><code class="bash"># Sur la machine hôte, recherchons les UID et GID de l'utilisateur courant
$ id
uid=1002(anoio) gid=1002(anoio) groups=1002(anoio),27(sudo)126(docker)
</code></pre>

<pre><code class="docker"># Dans le Dockerfile qui générera notre image, on change les identifiants de l'utilisateur dev
# pour qu'ils correspondent à ceux de l'utilisateur de la machine hôte
RUN change-dev-id 1002      # Change l'UID et le GID à 1002

# Autre exemple d'utilisation
RUN change-dev-id 1111 1234 # Change l'UID à 1111 et le GID à 1234
</code></pre>

A présent que nous avons une image de base, que nous savons nous connecter à un conteneur en cours d'exécution, que nous savons scripter l'installation les packages qui nécessitent une interaction avec l'utilisateur et que nous pouvons gérer les droits sur les fichiers partagés entre les conteneurs et la mâche hôte, nous allons voir une liste non exhaustive de `Dockerfiles` décrivant des images utiles pour du développement web.


## Les images filles

### Aperçu

Voici un shéma qui présente la hérarchie des images décrites dans cet article. Chaque image contient les programmes et expose les ports de son image parente (d'après l'instruction `FROM` de son `Dockerfile`).

<img title="Hérarchie des images" alt="Hérarchie des images" src="/assets/img/docker-images-hierarchy.png" width="100%" />

### Serveur d'e-mail

Retrouvez le `Dockerfile` et les fichiers associés [sur ce dépot](https://github.com/AlexisNo/docker-mailcatcher).

Pour pouvoir tester des envois d'e-mail et éviter d'en envoyer par accident, [utilisons `MailCatcher`](http://mailcatcher.me/). `MailCatcher` démarre un serveur `SMTP` sur le port `1025`. Les e-mails ne sont pas distribués mais ils sont présentés dans une interface web sur le port `1080`. Ceci permet de pouvoir développer et débugger les envois d'e-mails sans risquer d'en envoyer par erreur.

### Langages / Serveurs web

#### Apache + mod_php
Retrouvez le `Dockerfile` et les fichiers associés [sur ce dépot](https://github.com/AlexisNo/docker-apache-php-dev).

Notre serveur `apache-php` de développement **doit fournir des outils plus ou moins indispensables pour le développeur**. Voici ceux qui sont installés dans l'image :

* `Mailcatcher` pour pouvoir utiliser la commande `catchmail` analogue à `sendmail` et envoyer des emails sur un conteneur `mailcatcher`.
* `Xdebug` pour permettre de faire du debug et du profiling.
* `Composer` pour installer les dépendances des projets et certains outils du monde PHP.
* `phing` pour pouvoir exécuter des tâches.
* `PHPUnit` pour pouvoir lancer des tests unitaires.
* `PHPDocx` pour pouvoir générer de la phpdoc.
* Un script de génération de certificat auto-signé pour le développement des pages sécurisée.

A vous d'ajouter ou de remplacer certains outils par ceux que vous préférez.

La commande permettant de générer des certificats auto-signés est `gencert`. Si l'on souhaite générer un certificat dans une image fille, on utilisera une instruction `RUN` pour exécuter le script en lui passant le nom de domaine complet (`fqdn`, par exemple `www.mon-projet.local`) en argument.

    # Dockerfile fils
    RUN gencert www.mon-projet.local

Ensuite, il faudra configurer correctement le virtualhost du projet.

    # Virtualhost de mon-projet
    # /etc/apache2/sites-available/mon-projet.conf
    <VirtualHost \*:443>
      SSLEngine on
      SSLCertificateFile /etc/ssl/certs/www.mon-projet.local.crt
      SSLCertificateKeyFile /etc/ssl/certs/www.mon-projet.local.key
      # SSL Protocol Adjustments:
      BrowserMatch "MSIE [2-6]" \
                      nokeepalive ssl-unclean-shutdown \
                      downgrade-1.0 force-response-1.0
      # MSIE 7 and newer should be able to use keepalive
      BrowserMatch "MSIE [17-9]" ssl-unclean-shutdown

      # Complétez avec votre configuration de virtualhost
      ...
    </VirtualHost>

Par défaut, les conteneurs lancés par cette image retournent une page `phpinfo()` aux adresses http://localhost et https://localhost.

#### Nginx
Retrouvez le `Dockerfile` et les fichiers associés [sur ce dépot](https://github.com/AlexisNo/docker-nginx-dev).

Comme l'image `apache-php`, l'image `nginx` comporte la commande permettant de générer des certificats auto-signés `gencert`.

Les conteneurs lancés par cette image retournent la page par défaut de `Nginx` aux adresses http://localhost et https://localhost.

#### Nginx + PHP-FPM
Retrouvez le `Dockerfile` et les fichiers associés [sur ce dépot](https://github.com/AlexisNo/docker-nginx-php-dev).

Dans l'image `nginx-php`, on retrouve tous les utilitaires installés sur l'image `apache-php`. Mais cette fois, `PHP` fonctionne [avec `PHP-FPM`](http://php.net/manual/fr/install.fpm.php).

Par défaut, les conteneurs lancés par cette image retournent une page `phpinfo()` aux adresses http://localhost et https://localhost.

#### Node.js
Retrouvez le `Dockerfile` et les fichiers associés [sur ce dépot](https://github.com/AlexisNo/docker-nodejs-dev).

Le cas de `Node.js` est un peu différent puisqu'il ne s'agit pas vraiement d'un serveur web en tant que tel. La commande par défaut de cette image lance une console `Node.js`. Ce sera aux `Dockerfiles` des projets utilisant cette image de préciser la commande permettant de lancer leur application.

Quelques outils sont installés globalement avec l'utilisateur `dev`. C'est une bonne pratique que de ne pas utiliser `sudo` pour installer des packages globalement avec `npm`. Ces outils sonts :

 * [`forever`](https://www.npmjs.com/package/forever) pour contrõler l'execution des application.
 * [`yeoman`](https://www.npmjs.com/package/yo) pour utiliser des générateurs d'application.
 * [`bower`](http://bower.io/) pour la gestion des dépendances coté client.
 * Les lanceurs de tâches [`gulp`](https://www.npmjs.com/package/gulp) et [`grunt-cli`](https://www.npmjs.com/package/grunt-cli).
 * Le debugger [`node-inspector`](https://www.npmjs.com/package/node-inspector).

Lancer une console Node.js

    $ docker run -it alexisno/nodejs-dev

#### Python
Retrouvez le `Dockerfile` et les fichiers associés [sur ce dépot](https://github.com/AlexisNo/docker-python-dev).

Comme pour `Node.js`, il ne s'agit pas d'un serveur web en tant que tel. La commande par défaut de cette image lance une console `Python`. Ce sera aux `Dockerfiles` des projets utilisant cette image de préciser la commande permettant de lancer leur application.

Les modules installés globalement sont le debugger [`pdb`](https://pypi.python.org/pypi/pudb) et le shell [`ipython`](https://pypi.python.org/pypi/ipython/4.0.0)

Lancer une console Python:

    # Classique - python 2
    $ docker run -it alexisno/python-dev
    # IPython - python 2
    $ docker run -it alexisno/python-dev ipython

    # Classique - python 3
    $ docker run -it alexisno/python-dev python3
    # IPython - python 3
    $ docker run -it alexisno/python-dev ipython3

### Serveurs de bases de données

#### Profiter des fonctionalités fournies dans les images officielles
Pour les conteneurs de serveur de base de données, je préfère **utiliser [les images officielles](https://hub.docker.com/search/?q=database&page=1&isAutomated=0&isOfficial=1&pullCount=0&starCount=0)**. Les besoins ne sont pas les mêmes que pour les conteneurs qui exécutent le code de l'application et **nous pouvons nous passer des outils installés dans l'image de base**.

Ces images officielles peuvent faciliter l'initialisation des conteneurs (par exemple créer un utilisateur et définir son mot de passe) en passant des variables d'environnement lors du démarrage d'un conteneur. C'est le cas pour les images de [`PostgreSQL`](https://hub.docker.com/_/postgres/) et [`MariaDB`](https://hub.docker.com/_/mariadb/). Si besoin, on peut modifier la configuration de ces images en montant un fichier de configuration dans un volume ou en créant une nouvelle image se basant sur celle officielle.

#### Droits d'accès, persistance, sauvegarde et restauration  
**Les besoins pour la gestion des droits d'écriture et le backup des données sont différents** des images précédentes. Nous n'avons pas besoin de modifier les fichiers d'une base de données depuis la machine hôte comme nous le faisons pour le code. Il est préfèrable d'utiliser les volumes sans les monter depuis la machine hôte. On évite ainsi deux problèmes:

* Pas besoin de gérer les permissions sur les fichiers du volume entre la machine hôte et le conteneur (différences de `UID` / `GID` et droits de lecture / écriture / exécution).
* Lorsque l'on monte un volume de la machine hôte dans un conteneur, on écrase le contenu dans le conteneur si le dossier existe déjà. Ce dossier contient parfois des données nécessaire au serveur, même lorsqu'il ne contient pas encore de données (par exemple `/var/lib/mysql` ou  `/var/lib/postgresql/data`).

En contrepartie, **la persistance, la sauvegarde et la restauration des données seront un peu plus compliquées**. On peut utiliser [un conteneur destiné exclusivement au partage de volume](http://docs.docker.com/engine/userguide/dockervolumes/#adding-a-data-volume) pour gérer cela. Je vous conseille de bien lire et de bien comprendre [la documentation sur les volumes](http://docs.docker.com/engine/userguide/dockervolumes/) pour **choisir votre stratégie en fonction du projet**, de la quantité et du type de données, du nombre de personnes succeptibles de sauvegarder et/ou restaurer des données de test/développement.

---

Nous avons des images permettant de faire fonctionner les services qui nous intéressent avec les outils de développement adéquats. A présent nous devont faire communiquer les services impliqués dans le fonctionnement de nos applications et faciliter l'installation d'un nouvel environnement de développement complet. Vous pouvez [lire la suite à propos de la mise en place des environnements de développement](/monter-ses-environnements-de-developpement-avec-docker-partie-3/).
