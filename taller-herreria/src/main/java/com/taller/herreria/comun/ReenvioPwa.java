package com.taller.herreria.comun;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Hace que la PWA funcione al recargar en una dirección interna.
 *
 * El cliente Angular maneja sus propias rutas ("/trabajos/5"), pero esas
 * direcciones no existen como fichero en el servidor. Si el jefe está en
 * /trabajos/5 y pulsa F5, el navegador pide esa ruta a Spring Boot, que
 * busca un fichero con ese nombre, no lo encuentra y devuelve 404. Lo mismo
 * pasa al abrir un enlace guardado en favoritos o al reabrir la PWA
 * instalada en la tablet.
 *
 * La solución es devolver siempre index.html para lo que no sea un fichero
 * real ni una ruta de la API: Angular arranca y ya se encarga él de mostrar
 * la pantalla correcta.
 *
 * Importante: NO afecta a /api. Por un lado los @RestController tienen
 * prioridad sobre los recursos estáticos, y por otro se descarta a mano más
 * abajo, para que una ruta de API mal escrita siga dando un 404 en JSON y no
 * devuelva la página web, que sería desconcertante de depurar.
 */
@Configuration
public class ReenvioPwa implements WebMvcConfigurer {

    private static final String INDICE = "/static/index.html";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registro) {
        registro.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String rutaPedida, Resource ubicacion)
                            throws IOException {

                        Resource fichero = ubicacion.createRelative(rutaPedida);
                        if (fichero.exists() && fichero.isReadable()) {
                            return fichero;
                        }

                        // Que la API conserve sus propios 404 en JSON.
                        if (rutaPedida.startsWith("api/")) {
                            return null;
                        }

                        // Durante el desarrollo del backend puede no haberse
                        // compilado aún la PWA. Sin esta comprobación, todo
                        // fallaría con un error raro en vez de un 404 normal.
                        Resource indice = new ClassPathResource(INDICE);
                        return indice.exists() ? indice : null;
                    }
                });
    }
}
