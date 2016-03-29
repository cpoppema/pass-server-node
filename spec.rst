Pass Server Specifications
==========================

The goal of this document is to show you learn every feature a pass server
should be implementing if it wants to be able to support the latest available
version of the chrome browser extension in the webstore.

Below you can find a list of supported request paths the server responds to.

============== =======================
Path           Allowed request methods
============== =======================
/register/key/ PUT
/show/secret/  POST
/show/secrets/ POST
============== =======================

/register/key/ (draft)
----------------------

*pass-server-node: New in version 0.3.0*

Example request headers::

    PUT /register/key/
    Content-Type: application/json

Example request payload::

    {
        "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----..."
    }

Example response headers::

    204 No Content
    Content-Type: application/json

    {
        ??
    }

/show/secret/
--------------

*pass-server-node: Renamed in version 0.3.0, previously available at* ``/secret/``

Example request headers::

    POST /show/secret/
    Content-Type: application/json

Example request payload::

    {
        "path": "github.com",
        "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----...",
        "username": "rcaldwell"
    }

Example request response::

    200 OK
    Content-Type: application/json

    {
        "response": "-----BEGIN PGP MESSAGE-----..."
    }

/show/secrets/
--------------

*pass-server-node: Renamed in version 0.3.0, previously available at* ``/secrets/``

Example request headers::

    POST /show/secrets/
    Content-Type: application/json

Example request payload::

    {
        "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----..."
    }

Example request response::

    200 OK
    Content-Type: application/json

    {
        "response": "-----BEGIN PGP MESSAGE-----..."
    }

This encrypted message contains a JSON encoded message like this::

    [
      {
        "domain": "gmail.com",
        "path": "gmail.com",
        "username": "rcaldwell",
        "username_normalized": "rcaldwell"
      },
      {
        "domain": "bitbucket.org",
        "path": "work/bitbucket.org",
        "username": "ninapeña",
        "username_normalized": "ninapena"
      }
    ]

This response a list of secrets with 4 properties, these properties are
determined from looking at any given path a secret was found in a gpg-file.

1. domain: directory name the gpg file exists in
2. path: relative path from ``PASSWORD_STORE_DIR`` to the gpg-file
3. username: name of gpg-file without the ``.gpg``-part
4. username_normalized: unicode Normalization Form KD of ``username`` with unicode characters stripped afterwards

Given the information above you can see the following file tree::

    $ tree ~/.password-store | sed 's/├/\+/g; s/─/-/g; s/└/\\/g'
    /home/me/.password-store
    +-- gmail.com
    │   \-- rcaldwell.gpg
    \-- work
        \-- bitbucket.org
            \-- ninapeña.gpg

    3 directories, 2 files

Properties for ``~/.password-store/work/bitbucket.org/ninapeña.gpg``::

    domain: bitbucket.org
    path: work/bitbucket.org
    username: ninapeña
    username_normalized: ninapena

While searching in ``PASSWORD_STORE_DIR`` certain secrets are excluded: those
that are not placed inside a directory that is formatted like a domain.
I.e. there could be a hundred .gpg-files inside the directory
``~/.password-store/``, but they would all be hidden.


Error handling
--------------

While the client deals with basic server connection issues, the server itself
also needs to deal with certain aspects of expected and unexpected errors and
informing the client about it. The server always responds in JSON, no matter
what. This helps the clients to identify when the server might be down and e.g.
a response is returned from a reverse-proxy instead of the pass server.

Expected errors return any of the following HTTP statuses and may or may not
send along a message in a ``error`` property::

    400 Bad Request
    401 Bad Request
    500 Bad Request
    503 Bad Request

Expected errors are:

* Any endpoint: No public key found in request body (400).
* Any endpoint: Public key from request body could not be read (401).
* Any endpoint: Public key ID not found in the file ``$PASSWORD_STORE_DIR/.gpg-id`` (401).
* Any endpoint: If ``$PASSWORD_STORE_DIR/.gpg-id`` could not be read for any reason (500).
* Any endpoint: If any error occured while reading gpg-file (500).
* /show/secret/: No path found in request body (400).
* /show/secret/: No username found in request body (400).
* /show/secret/: If a gpg-file was requested that doesn't exist OR is outside ``$PASSWORD_STORE_DIR`` (400).
* /show/secret/: If any error occured while building a PGP message from a gpg-file (500).
* /show/secret/: If a gpp-file could not be accessed (e.g. incomplete file permissions) (503).
