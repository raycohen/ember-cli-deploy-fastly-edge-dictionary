# ember-cli-deploy-fastly-edge-dictionary

Similar to the functionality of [ember-cli-deploy-redis](https://github.com/ember-cli-deploy/ember-cli-deploy-redis), but uses Fastly edge dictionaries as the key-value store. You will likely want to pair this addon with an addon like ember-cli-deploy-redis so that your development and staging environments also have access to your uploaded index files.

## What are Fastly Edge Dictionaries?

[Fastly](https://www.fastly.com/) is a CDN. [Edge Dictionaries](https://docs.fastly.com/guides/edge-dictionaries/about-edge-dictionaries) are a simple key-value store that you can access via the Fastly API. You can reference the values stored in an edge dictionary in VCL - the configuration language used to control Fastly's custom version of Varnish.

## Example Configuration (simplified)

With the example configuration, requests to `/my/app/route` won't need to hit the origin server.

The `synthetic` command available within the `vcl_error` subroutine allows delivery of content defined in an edge dictionary. To use it, read the index content out of the edge dictionary and store it in a temporary header. Then use a custom error value to pass control to the `vcl_error` subroutine.

```
sub vcl_recv {

  if (req.url ~ "/my/app/route") {
    set req.http.X-Content = table.lookup(my_app_edge_dictionary, "my-app-prefix:index");
    error 910; # a custom error number to indicate `X-Content` should be used as the content
  }

  ...
}

sub vcl_error {

  if (obj.status == 910) {
    set obj.status = 200;
    set obj.http.Content-Type = "text/html";
    synthetic req.http.X-Content;
    return(deliver);
  }

  ...
}

```

## Useful considerations when using edge dictionaries

[limitations and considerations](https://docs.fastly.com/guides/edge-dictionaries/about-edge-dictionaries#limitations-and-considerations)

 * Dictionaries are limited to 1000 key-value pairs
 * Keys are limited to 256 characters
 * Values are limited to 8000 characters
 * You must create a dictionary using the API to be able to manipulate it using the API
 * You cannot use ESI behavior with content taken from a dictionary and delivered with `synthetic`
