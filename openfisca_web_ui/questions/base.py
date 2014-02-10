# -*- coding: utf-8 -*-


# OpenFisca -- A versatile microsimulation software
# By: OpenFisca Team <contact@openfisca.fr>
#
# Copyright (C) 2011, 2012, 2013, 2014 OpenFisca Team
# https://github.com/openfisca
#
# This file is part of OpenFisca.
#
# OpenFisca is free software; you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# OpenFisca is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.


"""Korma questions adapted to MongoDB"""


from biryani1.baseconv import cleanup_line, pipe
from korma.base import Input
from korma.checkbox import Checkbox as KormaCheckbox
from korma.date import Date
from korma import helpers
from korma.repeat import Repeat as KormaRepeat

from ..conv import base


Checkbox = lambda *args, **kwargs: \
    KormaCheckbox(
        inner_html_template = u'''
<div class="col-sm-offset-4 col-sm-8">
  <div class="checkbox">
    <label>{self.control_html} {self.label}</label>
  </div>
</div>''',
        *args, **kwargs)


class Hidden(Input):
    type = u'hidden'

    @property
    def control_attributes(self):
        return helpers.merge_mappings(
            super(Hidden, self).control_attributes,
            {u'value': self.value},
        )

    @property
    def default_input_to_data(self):
        return cleanup_line


class MongoDate(Date):
    @property
    def data_to_str(self):
        return pipe(base.datetime_to_date, super(MongoDate, self).data_to_str)

    @property
    def default_input_to_data(self):
        return pipe(super(MongoDate, self).default_input_to_data, base.date_to_datetime)


FrenchDate = lambda placeholder = u'dd/mm/yyyy', *args, **kwargs: \
    MongoDate(format=u'%d/%m/%Y', placeholder=placeholder, *args, **kwargs)


Repeat = lambda add_button_label = u'Ajouter', *args, **kwargs: \
    KormaRepeat(add_button_classes = u'add btn', add_button_label = add_button_label, javascript_add_button=False,
                *args, **kwargs)
