En contrepartie, la persistance et la sauvegarde/restauration des données seront un peu plus compliquées. Par exemple, on pourra utiliser l'option `--volumes-from` pour créer une archive ...

    # Pour MariaDB
    $ docker run --volumes-from mon_conteneur_mariadb -v $(pwd):/backup ubuntu tar cvf /backup/backup.tar /var/lib/mysql

    # Pour PostgreSQL
    $ docker run --volumes-from mon_conteneur_postgres -v $(pwd):/backup ubuntu tar cvf /backup/backup.tar /var/lib/postgresql/data

... et restaurer les données dans un autre conteneur.

    # Pour MariaDB
    # Créer un nouveau conteneur
    $ docker run --name un_nouveau_conteneur_mariadb ubuntu /bin/bash
    # Copier les données dans le nouveau conteneur
    $ docker run --volumes-from un_nouveau_conteneur_mariadb -v $(pwd):/backup ubuntu cd /var/lib/mysql && tar xvf /backup/backup.tar

    # Pour PostgreSQL
    # Créer un nouveau conteneur
    $ docker run --name un_nouveau_conteneur_postgres ubuntu /bin/bash
    # Copier les données dans le nouveau conteneur
    $ docker run --volumes-from un_nouveau_conteneur_postgres -v $(pwd):/backup ubuntu cd /var/lib/postgresql/data && tar xvf /backup/backup.tar

On peut aussi penser à utiliser [un conteneur destiné exclusivement au partage de volume](http://docs.docker.com/engine/userguide/dockervolumes/#adding-a-data-volume).
