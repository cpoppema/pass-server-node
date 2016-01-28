# pass-server-node

pass-server-node is a read-only portal to `pass`. Read all about `pass` [here](http://www.passwordstore.org).

## How to use

If you have not installed a compatible browser plugin yet, you can just install one:

* [extension](https://github.com/cpoppema/pass-browser-chrome#how-to-install) for chrome and chromium

For this setup to work, secrets must be stored in the format `url/username`, for example: `github.com/cpoppema`. You can still categorize secrets since the server assumes the filename is the username and the directory the secrets exists in is the url. Multiline secrets are not an issue since the browser plugin only uses the first line of your secret as the password.

## How to install

This project is exposing the password store managed by `pass` using HTTP, making your secrets more easily accessible from anywhere.

The only things required are that you have Node 4.x and a decent version of NPM installed.

To start things after you cloned this repository you simply install the modules and start the server with:

```Shell
npm install
npm start
```

**Configuration**

This application uses two variables to determine what port to bind to and the location of the password store. You can provide those in three ways:

```
npm --port=8080 --password_store_dir=~/.password-store-dir start
```

```
PORT=8080 PASSWORD_STORE_DIR=~/.password-store-dir npm start
```

```
npm config set pass-server-node:port 8080
npm config set pass-server-node:password_store_dir /password-store-dir
npm start
```

The variables are also read in this order. If you do not change them, the config in package.json will be used. If you want to reset the values set with `npm config`, remove those from `~/.npmrc` or wherever your npmrc exists.

**Notes**

This application only binds to localhost. You should always use HTTPS to serve this application. Please use any web server (like Nginx) configured to serve this through an HTTPS-enabled reverse proxy.

**Credits**

* [Jason](http://www.zx2c4.com/) for writing `pass`.
