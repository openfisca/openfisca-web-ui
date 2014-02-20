## -*- coding: utf-8 -*-


## OpenFisca -- A versatile microsimulation software
## By: OpenFisca Team <contact@openfisca.fr>
##
## Copyright (C) 2011, 2012, 2013, 2014 OpenFisca Team
## https://github.com/openfisca
##
## This file is part of OpenFisca.
##
## OpenFisca is free software; you can redistribute it and/or modify
## it under the terms of the GNU Affero General Public License as
## published by the Free Software Foundation, either version 3 of the
## License, or (at your option) any later version.
##
## OpenFisca is distributed in the hope that it will be useful,
## but WITHOUT ANY WARRANTY; without even the implied warranty of
## MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
## GNU Affero General Public License for more details.
##
## You should have received a copy of the GNU Affero General Public License
## along with this program.  If not, see <http://www.gnu.org/licenses/>.


<%!
from biryani1 import strings

from openfisca_web_ui import urls, uuidhelpers
%>


<%def name="render_legislation_node(node)" filter="trim">
    % if node.get('@type') == 'Node':
        % for node_name in node['children']:
<%
            node_title = node['children'][node_name].get('description')
            node_slug = strings.slugify(node_title)
%>\
                        <p>
                            <a href="#" class="collapse-node-toggle collapsed" type="button" data-toggle="collapse" \
data-target="#node-${node_slug}">
                                <span></span>
                                ${node_title}
                            </a>
                        </p>
                        <div id="node-${node_slug}" class="collapse collapse-node">
                            <%self:render_legislation_node node="${node['children'][node_name]}"/>
                        </div>
        % endfor
    % elif node.get('@type') == 'Scale':
        <%self:render_legislation_scale scale="${node}"/>
    % elif node.get('@type') == 'Parameter':
        <%self:render_legislation_parameter parameter="${node['values']}"/>
    % endif
</%def>


<%def name="render_legislation_scale(scale)" filter="trim">
    <table class="table table-condensed">
        <thead>
            <tr>
                <th>Seuil</th>
                <th>Assiette</th>
                <th>Taux</th>
            </tr>
        </thead>
        <tbody>
    % for slice in scale.get('slices'):
            <tr>
                <td>${slice['threshold'][-1].get('value') if slice.get('threshold') else ''}</td>
                <td>${slice['base'][-1].get('value') if slice.get('base') else ''}</td>
                <td>${slice['rate'][-1].get('value') if slice.get('rate') else ''}</td>
            </tr>
    % endfor
        </tbody>
    </table>
</%def>


<%def name="render_legislation_parameter(parameter)" filter="trim">
    ${parameter[-1].get('value')}
</%def>


<%def name="scripts()" filter="trim">
    <script src="${urls.get_url(ctx, u'bower/requirejs/require.js')}"></script>
    <script>
<%
requireconfig = {
    'urlArgs': u'bust={}'.format(uuidhelpers.url_bust()),
    'paths': {
        # Bower components
        'bootstrap': urls.get_url(ctx, u'bower/bootstrap/dist/js/bootstrap'),
        'domReady': urls.get_url(ctx, u'bower/requirejs-domready/domReady'),
        'jquery': urls.get_url(ctx, u'bower/jquery/jquery'),
        },
    'shim': {
        'bootstrap': {'exports': 'Bootstrap', 'deps': ['jquery']},
        'jquery': {'exports': '$'},
        },
    }
%>\
require.config(${requireconfig | n, js});
require([${urls.get_url(ctx, u'js/legislation.js') | n, js}]);
    </script>
</%def>
