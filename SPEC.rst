Pass Server Specifications
==========================

The goal of this document is to create insights in what a pass server should do.
You should be able to learn about every feature a pass server should be
implementing if it wants to support the latest available version of the chrome
browser extension available in the Chrome Web Store.

.. contents:: Contents:
   :depth: 3

Error handling
--------------

While the client deals with basic server connection issues, the server also
needs to deal with certain aspects of expected and unexpected errors and
informing the client about it. The server always responds in JSON, no matter
what. This helps the client to identify when the server might be down and e.g.
a response is returned from a reverse-proxy instead of the pass server.

Expected errors return any of the following HTTP statuses and may or may not
send along a message in a ``error`` property::

    400 Bad Request
    401 Bad Request
    500 Bad Request
    503 Bad Request

Expected errors are:

* Any endpoint: No public key found in request body (400).
* Any endpoint: Public key from request body could not be parsed as a public key
  (401).
* Any endpoint: Public key ID not found in the file
  ``$PASSWORD_STORE_DIR/.gpg-id`` (401).
* Any endpoint: If ``$PASSWORD_STORE_DIR/.gpg-id`` could not be read for any
  reason (500).
* Any endpoint: If any error occured while reading .gpg-file (500).
* /secret/: No path found in request body (400).
* /secret/: No username found in request body (400).
* /secret/: If a .gpg-file was requested that doesn't exist OR is outside
  ``$PASSWORD_STORE_DIR`` (400).
* /secret/: If any error occured while building a PGP message from a .gpg-file
  (500).
* /secret/: If a .gpg-file could not be accessed (e.g. incomplete file
  permissions) (503).

Key IDs
-------

Pass server supports the following key formats:

- 8-character key ID
- 8-character key ID, prefixed with either ``0x`` or ``0``
- 16-character key ID
- 16-character key ID, prefixed with either ``0x`` or ``0``

Request endpoints
-----------------

Below you can find a list of request paths the server should respond to.

========= =======================
Path      Allowed request methods
========= =======================
/secrets/ POST
/secret/  POST
========= =======================

/secrets/
~~~~~~~~~

Example request headers::

    POST /secrets/
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

This is a list of secrets with 4 properties each, these properties are
determined from looking at any given path of .gpg-files inside the password
store directory:

1. ``domain``: name of the directory the .gpg-file exists in
2. ``path``: relative path from ``PASSWORD_STORE_DIR`` to the .gpg-file
3. ``username``: name of .gpg-file without the ``.gpg``-part
4. ``username_normalized``: unicode Normalization Form KD of ``username`` and
   stripped of unicode characters

Given the example JSON message above you can determine the following file tree::

    $ tree ~/.password-store | sed 's/├/\+/g; s/─/-/g; s/└/\\/g'
    /home/me/.password-store
    +-- gmail.com
    │   \-- rcaldwell.gpg
    \-- work
        \-- bitbucket.org
            \-- ninapeña.gpg

    3 directories, 2 files

The properties for the file ``ninapeña.gpg`` are therefore determined as::

    {
      "domain": "bitbucket.org",
      "path": "work/bitbucket.org".
      "username": "ninapeña",
      "username_normalized": "ninapena"
    }

While searching in ``PASSWORD_STORE_DIR`` certain secrets are excluded: those
that are not placed inside a directory (since the directory name is used as the
domain). I.e. there could be a hundred .gpg-files inside the directory
``~/.password-store/``, but none would be exposed by a pass server. Other files,
like ``contains-very-secret-notes.txt`` are not recognized as a .gpg-file and
are ignored in building the list of secrets.

/secret/
~~~~~~~~

Example request headers::

    POST /secret/
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
